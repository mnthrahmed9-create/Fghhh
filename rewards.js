/* ============================================================
   rewards.js
   ============================================================
   نظام المكافآت — المنطق الكامل.
   يعتمد على window.REWARDS_CONFIG (يجب تحميل rewards-config.js أولاً).
   يوفر window.RewardsSystem بكل الدوال التي يتوقعها التطبيق.
   ============================================================ */

(function () {
    'use strict';

    /* ---------- التحقق من ملف التهيئة ---------- */
    const CFG = window.REWARDS_CONFIG;
    if (!CFG) {
        console.error('[Rewards] rewards-config.js غير محمّل! يجب تحميله قبل rewards.js');
        return;
    }

    /* =========================================================
       1) طبقة التخزين (SafeStorage إن توفّر، وإلا fallback)
       ========================================================= */
    const store = (function () {
        const mem = {};
        try {
            const t = '__rw_test__' + Date.now();
            localStorage.setItem(t, '1');
            localStorage.removeItem(t);
            return {
                get: k => { try { return localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
            };
        } catch (e) {
            return {
                get: k => (k in mem ? mem[k] : null),
                set: (k, v) => { mem[k] = v; }
            };
        }
    })();

    /* =========================================================
       2) الحالة (State)
       ========================================================= */
    function todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    function defaultState() {
        return {
            version: CFG.version,
            balance: { ...CFG.initialBalance },
            daily:   { streak: 0, lastClaimDate: null },
            achievements:    {},         // key → progress
            missions: {
                date:     todayStr(),
                progress: {}             // key → progress
            },
            claimed: {
                achievements: {},        // key → true
                missions:     {}         // key → true (يُعاد يومياً)
            },
            chests: {
                hero: { lastOpen: 0 }
            }
        };
    }

    function loadState() {
        const raw = store.get(CFG.storageKey);
        if (!raw) return defaultState();
        try {
            const parsed = JSON.parse(raw);
            if (parsed.version !== CFG.version) return defaultState();
            return Object.assign(defaultState(), parsed);
        } catch (e) {
            return defaultState();
        }
    }

    function saveState() {
        store.set(CFG.storageKey, JSON.stringify(state));
    }

    let state = loadState();

    /* =========================================================
       3) الأحداث (Events)
       ========================================================= */
    function emit(name, detail) {
        try {
            window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
        } catch (e) { /* ignore */ }
    }
    function emitBalance() {
        emit('rewards:balanceChanged', { ...state.balance });
    }
    function emitChange() {
        emit('rewards:stateChanged');
    }

    /* =========================================================
       4) العملات والخبرة
       ========================================================= */
    function addCurrency(type, amount, reason) {
        if (!amount || amount <= 0) return;
        state.balance[type] = (state.balance[type] || 0) + amount;
        saveState();
        emitBalance();
        emit('rewards:currencyAdded', { type, amount, reason: reason || '' });
        emitChange();
    }

    function computeLevel(xp) {
        const curve = CFG.levelCurve;
        let level = 1;
        for (let i = 1; i < curve.length; i++) {
            if (xp >= curve[i]) level = i + 1;
            else break;
        }
        return level;
    }

    function addXP(amount) {
        if (!amount || amount <= 0) return;
        state.balance.xp = (state.balance.xp || 0) + amount;
        const newLevel = computeLevel(state.balance.xp);
        if (newLevel > state.balance.level) {
            const levelsUp = newLevel - state.balance.level;
            state.balance.level = newLevel;
            saveState();
            emitBalance();
            // مكافأة الترقية
            const b = CFG.levelUpBonus;
            if (b.coinsPerLevel) addCurrency('coins', b.coinsPerLevel * levelsUp, 'مكافأة الترقية');
            if (b.gemsPerLevel)  addCurrency('gems',  b.gemsPerLevel  * levelsUp, 'مكافأة الترقية');
            emit('rewards:levelUp', { level: newLevel });
        } else {
            saveState();
            emitBalance();
        }
    }

    /* =========================================================
       5) المكافآت اليومية
       ========================================================= */
    function getDailyStatus() {
        const today    = todayStr();
        const lastDate = state.daily.lastClaimDate;
        const streak   = state.daily.streak || 0;

        let canClaim     = true;
        let currentIndex = 0;

        if (lastDate === today) {
            canClaim     = false;
            currentIndex = Math.max(0, streak - 1);
        } else {
            let wasYesterday = false;
            if (lastDate) {
                const last = new Date(lastDate + 'T00:00:00');
                const now  = new Date(today    + 'T00:00:00');
                const diff = Math.floor((now - last) / 86400000);
                wasYesterday = (diff === 1);
            }
            currentIndex = (!lastDate || !wasYesterday) ? 0 : (streak % 7);
        }

        const rewards = CFG.dailyRewards.map((rw, i) => ({
            day:      rw.day,
            icon:     rw.icon,
            amount:   rw.amount,
            type:     rw.type,
            claimed:  i < currentIndex || (i === currentIndex && !canClaim),
            isCurrent: i === currentIndex && canClaim
        }));

        return { rewards, canClaim, currentIndex };
    }

    function claimDaily(index) {
        const status = getDailyStatus();
        if (!status.canClaim)             return { ok: false, error: 'لا يمكن الاستلام الآن' };
        if (index !== status.currentIndex) return { ok: false, error: 'مكافأة غير صحيحة' };

        const reward = CFG.dailyRewards[index];
        if (!reward) return { ok: false, error: 'مكافأة غير موجودة' };

        addCurrency(reward.type, reward.amount, 'مكافأة يومية');
        if (CFG.dailyXPBonus) addXP(CFG.dailyXPBonus);

        // تحديث الـ streak
        const today    = todayStr();
        const lastDate = state.daily.lastClaimDate;
        let streak     = state.daily.streak || 0;

        if (lastDate) {
            const last = new Date(lastDate + 'T00:00:00');
            const now  = new Date(today    + 'T00:00:00');
            const diff = Math.floor((now - last) / 86400000);
            streak = (diff === 1) ? streak + 1 : 1;
        } else {
            streak = 1;
        }

        state.daily.streak        = streak;
        state.daily.lastClaimDate = today;
        saveState();
        emitChange();

        return { ok: true, reward: { type: reward.type, amount: reward.amount } };
    }

    /* =========================================================
       6) الإنجازات
       ========================================================= */
    function getAchievements() {
        return CFG.achievements.map(a => {
            const progress  = Math.min(state.achievements[a.key] || 0, a.target);
            const completed = progress >= a.target;
            const claimed   = !!state.claimed.achievements[a.key];
            return {
                key: a.key,
                name: a.name,
                target: a.target,
                progress,
                percent: Math.round((progress / a.target) * 100),
                completed,
                claimed,
                reward: a.reward
            };
        });
    }

    function updateAchievement(key, amount) {
        const def = CFG.achievements.find(a => a.key === key);
        if (!def) return;
        const old = state.achievements[key] || 0;
        const cur = Math.min(old + amount, def.target);
        state.achievements[key] = cur;
        saveState();
        if (old < def.target && cur >= def.target) {
            emit('rewards:achievementCompleted', { def });
        }
        emitChange();
    }

    function claimAchievement(key) {
        const def = CFG.achievements.find(a => a.key === key);
        if (!def) return { ok: false, error: 'إنجاز غير موجود' };
        if ((state.achievements[key] || 0) < def.target)
            return { ok: false, error: 'لم يكتمل بعد' };
        if (state.claimed.achievements[key])
            return { ok: false, error: 'تم الاستلام مسبقاً' };

        state.claimed.achievements[key] = true;
        saveState();
        addCurrency('coins', def.reward, 'إنجاز: ' + def.name);
        return { ok: true, reward: def.reward };
    }

    /* =========================================================
       7) المهام اليومية
       ========================================================= */
    function checkMissionReset() {
        const today = todayStr();
        if (state.missions.date !== today) {
            state.missions.date     = today;
            state.missions.progress = {};
            state.claimed.missions  = {};
            saveState();
        }
    }

    function getMissions() {
        checkMissionReset();
        return CFG.missions.map(m => {
            const progress  = Math.min(state.missions.progress[m.key] || 0, m.target);
            const completed = progress >= m.target;
            const claimed   = !!state.claimed.missions[m.key];
            return {
                key: m.key,
                name: m.name,
                target: m.target,
                progress,
                percent: Math.round((progress / m.target) * 100),
                completed,
                claimed,
                reward: m.reward
            };
        });
    }

    function updateMission(key, amount) {
        checkMissionReset();
        const def = CFG.missions.find(m => m.key === key);
        if (!def) return;
        const old = state.missions.progress[key] || 0;
        const cur = Math.min(old + amount, def.target);
        state.missions.progress[key] = cur;
        saveState();
        if (old < def.target && cur >= def.target) {
            emit('rewards:missionCompleted', { def });
        }
        emitChange();
    }

    function claimMission(key) {
        checkMissionReset();
        const def = CFG.missions.find(m => m.key === key);
        if (!def) return { ok: false, error: 'مهمة غير موجودة' };
        if ((state.missions.progress[key] || 0) < def.target)
            return { ok: false, error: 'لم تكتمل بعد' };
        if (state.claimed.missions[key])
            return { ok: false, error: 'تم الاستلام مسبقاً' };

        state.claimed.missions[key] = true;
        saveState();
        addCurrency('coins', def.reward, 'مهمة: ' + def.name);
        return { ok: true, reward: def.reward };
    }

    /* =========================================================
       8) الصناديق
       ========================================================= */
    function getChestStatus(id) {
        const def = CFG.chests[id];
        if (!def) return null;
        const last      = (state.chests[id] && state.chests[id].lastOpen) || 0;
        const remaining = Math.max(0, (last + def.cooldownMs) - Date.now());
        return {
            ready:       remaining <= 0,
            cost:        def.cost,
            remainingMs: remaining
        };
    }

    function openChest(id) {
        const def = CFG.chests[id];
        if (!def) return { ok: false, error: 'صندوق غير موجود' };

        const status = getChestStatus(id);
        if (!status.ready) return { ok: false, error: 'الصندوق غير جاهز' };

        // تحقق من التكلفة
        for (const cur in def.cost) {
            if ((state.balance[cur] || 0) < def.cost[cur]) {
                return { ok: false, error: 'رصيد غير كافٍ' };
            }
        }
        // خصم التكلفة
        for (const cur in def.cost) {
            state.balance[cur] -= def.cost[cur];
        }
        saveState();
        emitBalance();

        // اختيار الجائزة
        const reward = rollReward(def.rewards);

        // تحديث وقت الفتح
        state.chests[id] = { lastOpen: Date.now() };
        saveState();

        // منح الجائزة
        if (reward) addCurrency(reward.type, reward.amount, 'صندوق: ' + def.name);

        return { ok: true, reward };
    }

    function rollReward(table) {
        const total = table.reduce((s, r) => s + r.weight, 0);
        let roll = Math.random() * total;
        for (const entry of table) {
            roll -= entry.weight;
            if (roll <= 0) {
                const amount = Math.floor(
                    entry.min + Math.random() * (entry.max - entry.min + 1)
                );
                return { type: entry.type, amount };
            }
        }
        return null;
    }

    /* =========================================================
       9) تسجيل أحداث اللعب
       ========================================================= */
    function recordGame(result) {
        // result: 'win' | 'loss' | 'draw'
        const xp = CFG.xpRewards;
        if (result === 'win')        addXP(xp.win  || 0);
        else if (result === 'draw')  addXP(xp.draw || 0);
        else                         addXP(xp.loss || 0);
        emitChange();
    }

    function recordCapture(count) {
        if (!count || count <= 0) return;
        const xp = CFG.xpRewards;
        if (xp.capture) addXP(xp.capture * count);
    }

    /* =========================================================
       10) الواجهة العامة
       ========================================================= */
    function getBalance() {
        return { ...state.balance };
    }

    window.RewardsSystem = {
        version: CFG.version,

        // الرصيد
        getBalance,
        addCoins:    (a, r) => addCurrency('coins', a, r),
        addGems:     (a, r) => addCurrency('gems',  a, r),
        addTrophies: (a, r) => addCurrency('trophies', a, r),
        addXP,

        // اليومية
        getDailyStatus,
        claimDaily,

        // الإنجازات
        getAchievements,
        updateAchievement,
        claimAchievement,

        // المهام
        getMissions,
        updateMission,
        claimMission,

        // الصناديق
        getChestStatus,
        openChest,

        // اللعب
        recordGame,
        recordCapture,

        // أدوات تصحيح
        _state: () => JSON.parse(JSON.stringify(state)),
        _reset: () => {
            state = defaultState();
            saveState();
            emitBalance();
            emitChange();
        }
    };

    /* ---------- إطلاق الحدث الأولي بعد تحميل التطبيق ---------- */
    setTimeout(() => emitBalance(), 0);

    console.log('[Rewards] ✅ النظام جاهز — الإصدار ' + CFG.version);
})();
