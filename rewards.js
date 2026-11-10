/* ============================================================
   rewards.js — Monster Chess 3D (النسخة الاحترافية - ذهب 🪙)
   يعمل بسلاسة مع index.html الحالي بدون تعديل.
   ============================================================ */
(function () {
    'use strict';

    const Storage = window.SafeStorage || (function () {
        let mem = {};
        return {
            getItem: k => { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
            setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
            removeItem: k => { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
        };
    })();

    // غيرنا اسم المفتاح لضمان بداية نظيفة للعملات
    const STORAGE_KEY = 'monsterChessRewards_v2_Coins';

    /* ============================================================
       إعدادات المكافآت (ذهب 🪙)
       ============================================================ */
    const DAILY_REWARDS = [
        { day: 1, type: 'coins', amount: 100,  icon: '🪙' },
        { day: 2, type: 'coins', amount: 250,  icon: '🪙' },
        { day: 3, type: 'gems',  amount: 5,    icon: '💎' },
        { day: 4, type: 'coins', amount: 500,  icon: '🪙' },
        { day: 5, type: 'gems',  amount: 10,   icon: '💎' },
        { day: 6, type: 'coins', amount: 1000, icon: '🪙' },
        { day: 7, type: 'gems',  amount: 25,   icon: '💎' }
    ];

    const ACHIEVEMENTS_DEF = [
        { key: 'win1',      name: '🏅 أول فوز',            target: 1,   reward: 100,  type: 'wins' },
        { key: 'win5',      name: '⚔️ محارب صاعد',         target: 5,   reward: 500,  type: 'wins' },
        { key: 'win20',     name: '🔥 بطل الميدان',        target: 20,  reward: 2000, type: 'wins' },
        { key: 'win50',     name: '👑 أسطورة الشطرنج',     target: 50,  reward: 5000, type: 'wins' },
        { key: 'capture10', name: '💀 سفاح البيادق',       target: 10,  reward: 150,  type: 'captures' },
        { key: 'capture50', name: '☠️ مدمر الجيوش',        target: 50,  reward: 800,  type: 'captures' },
        { key: 'capture100',name: '🩸 سفاح محترف',         target: 100, reward: 1500, type: 'captures' },
        { key: 'play10',    name: '♟️ لاعب مخلص',          target: 10,  reward: 200,  type: 'gamesPlayed' },
        { key: 'play50',    name: '🏛️ أسطورة الزمن',       target: 50,  reward: 1500, type: 'gamesPlayed' },
        { key: 'play100',   name: '🌌 خالد',               target: 100, reward: 4000, type: 'gamesPlayed' }
    ];

    const MISSIONS_DEF = [
        { key: 'play1',    name: '🎯 العب مباراة واحدة',    target: 1,  reward: 50,  type: 'gamesPlayed' },
        { key: 'win1',     name: '🏆 اربح مباراة',           target: 1,  reward: 150, type: 'wins' },
        { key: 'capture3', name: '⚔️ أسقط 3 قطع',            target: 3,  reward: 100, type: 'captures' },
        { key: 'capture5', name: '🩸 أسقط 5 قطع',            target: 5,  reward: 200, type: 'captures' }
    ];

    const CHESTS_DEF = {
        star: { 
            cost: { coins: 1000 }, 
            cooldownMs: 2 * 60 * 60 * 1000, // ساعتان
            rewards: [
                { type: 'coins', min: 500,  max: 2000, weight: 50 },
                { type: 'gems',  min: 5,    max: 25,   weight: 35 },
                { type: 'xp',    min: 50,   max: 200,  weight: 15 }
            ]
        }
    };

    /* ============================================================
       الحالة الافتراضية (عملات ذهبية)
       ============================================================ */
    const DEFAULT_STATE = {
        balance: { coins: 500, gems: 10, level: 1, xp: 0 },
        daily:   { lastClaimDate: null, streak: 0, claimedDays: [] },
        achievements: {},
        missions:     {},
        chests:       {},
        totals: { wins: 0, losses: 0, gamesPlayed: 0, captures: 0 }
    };

    let state = loadState();

    /* ============================================================
       أدوات مساعدة
       ============================================================ */
    const todayKey = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const daysBetween = (a, b) => {
        if (!a || !b) return Infinity;
        const d1 = new Date(a + 'T00:00:00');
        const d2 = new Date(b + 'T00:00:00');
        return Math.round((d2 - d1) / 86400000);
    };
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

    function mergeDeep(target, src) {
        if (!src || typeof src !== 'object') return target;
        Object.keys(src).forEach(k => {
            if (Array.isArray(src[k]) || typeof src[k] !== 'object' || src[k] === null) {
                target[k] = src[k];
            } else {
                if (!target[k] || typeof target[k] !== 'object') target[k] = {};
                mergeDeep(target[k], src[k]);
            }
        });
        return target;
    }

    function loadState() {
        try {
            const raw = Storage.getItem(STORAGE_KEY);
            if (!raw) return deepClone(DEFAULT_STATE);
            return mergeDeep(deepClone(DEFAULT_STATE), JSON.parse(raw));
        } catch (e) { return deepClone(DEFAULT_STATE); }
    }

    function saveState() {
        try { Storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    /* ============================================================
       نظام الأحداث (Events)
       ============================================================ */
    function emit(name, detail) {
        try { window.dispatchEvent(new CustomEvent('rewards:' + name, { detail })); } catch (e) {}
    }

    function emitBalanceChanged() {
        emit('balanceChanged', { ...state.balance });
    }

    function emitStateChanged() {
        emit('stateChanged', { state: deepClone(state) });
    }

    /* ============================================================
       المستويات (Levels & XP)
       ============================================================ */
    function xpForLevel(level) {
        return Math.floor(100 * Math.pow(level, 1.5));
    }

    function addXp(amount) {
        if (amount <= 0) return;
        state.balance.xp += amount;
        let leveled = false;
        while (state.balance.xp >= xpForLevel(state.balance.level)) {
            state.balance.xp -= xpForLevel(state.balance.level);
            state.balance.level += 1;
            leveled = true;
            emit('levelUp', { level: state.balance.level });
            state.balance.gems += 10; // مكافأة ترقية المستوى
        }
        if (leveled) emitBalanceChanged();
    }

    /* ============================================================
       الواجهة العامة (Public API)
       ============================================================ */
    const RewardsSystem = {

        getBalance() {
            return { ...state.balance };
        },

        getLevelInfo() {
            return {
                level: state.balance.level,
                xp: state.balance.xp,
                nextLevelXp: xpForLevel(state.balance.level),
                percent: Math.floor((state.balance.xp / xpForLevel(state.balance.level)) * 100)
            };
        },

        addCoins(amount, reason = '') {
            if (amount <= 0) return { ok: false };
            state.balance.coins += amount;
            addXp(Math.floor(amount / 5)); // 5 عملات = 1 XP
            saveState();
            emitBalanceChanged();
            emit('currencyAdded', { type: 'coins', amount, reason });
            return { ok: true };
        },

        addGems(amount, reason = '') {
            if (amount <= 0) return { ok: false };
            state.balance.gems += amount;
            saveState();
            emitBalanceChanged();
            emit('currencyAdded', { type: 'gems', amount, reason });
            return { ok: true };
        },

        // للتوافق مع الكود القديم
        addStars(amount, reason = '') {
            return this.addCoins(amount, reason);
        },

        spendCoins(amount) {
            if (state.balance.coins < amount) return { ok: false, error: 'لا توجد عملات كافية' };
            state.balance.coins -= amount;
            saveState();
            emitBalanceChanged();
            return { ok: true };
        },

        /* ---------- المكافآت اليومية ---------- */
        getDailyStatus() {
            const today = todayKey();
            const last = state.daily.lastClaimDate;
            const gap = last ? daysBetween(last, today) : Infinity;
            let streak = state.daily.streak || 0;
            let claimedDays = [...(state.daily.claimedDays || [])];

            if (gap > 1 && last !== null) {
                streak = 0;
                claimedDays = [];
            }

            let currentIndex = streak % 7;
            const canClaim = (last !== today);

            const rewards = DAILY_REWARDS.map((r, i) => {
                const claimed = claimedDays.includes(i);
                return { ...r, claimed, isCurrent: (i === currentIndex) && !claimed && canClaim };
            });

            return { rewards, streak, canClaim, currentDay: currentIndex + 1 };
        },

        claimDaily(index) {
            const status = this.getDailyStatus();
            if (!status.canClaim) return { ok: false, error: 'تم الاستلام مسبقاً' };
            if (index !== status.currentDay - 1) return { ok: false, error: 'غير متاح' };

            const rw = DAILY_REWARDS[index];
            if (rw.type === 'coins') this.addCoins(rw.amount, 'مكافأة يومية');
            else if (rw.type === 'gems') this.addGems(rw.amount, 'مكافأة يومية');

            const today = todayKey();
            const gap = state.daily.lastClaimDate ? daysBetween(state.daily.lastClaimDate, today) : Infinity;
            state.daily.streak = (gap === 1) ? (state.daily.streak || 0) + 1 : 1;
            state.daily.lastClaimDate = today;
            
            if (!state.daily.claimedDays) state.daily.claimedDays = [];
            if (!state.daily.claimedDays.includes(index)) state.daily.claimedDays.push(index);

            if (state.daily.streak > 7) {
                state.daily.streak = 1;
                state.daily.claimedDays = [index];
            }

            saveState();
            emitStateChanged();
            return { ok: true, reward: rw };
        },

        /* ---------- الإنجازات ---------- */
        getAchievements() {
            return ACHIEVEMENTS_DEF.map(def => {
                const s = state.achievements[def.key] || { progress: 0, claimed: false };
                const progress = clamp(s.progress, 0, def.target);
                return {
                    ...def, progress,
                    completed: progress >= def.target,
                    claimed: !!s.claimed,
                    percent: Math.round((progress / def.target) * 100)
                };
            });
        },

        updateAchievement(key, delta) {
            const def = ACHIEVEMENTS_DEF.find(a => a.key === key);
            if (!def) return;
            if (!state.achievements[key]) state.achievements[key] = { progress: 0, claimed: false };
            const before = state.achievements[key].progress;
            state.achievements[key].progress = Math.min(def.target, before + delta);
            saveState();
            if (before < def.target && state.achievements[key].progress >= def.target) {
                emit('achievementCompleted', { key, def });
            }
            emitStateChanged();
        },

        claimAchievement(key) {
            const def = ACHIEVEMENTS_DEF.find(a => a.key === key);
            if (!def) return { ok: false, error: 'غير موجود' };
            const s = state.achievements[key];
            if (!s || s.progress < def.target) return { ok: false, error: 'لم يكتمل' };
            if (s.claimed) return { ok: false, error: 'تم الاستلام' };
            s.claimed = true;
            this.addCoins(def.reward, `إنجاز: ${def.name}`);
            saveState();
            return { ok: true, reward: def.reward };
        },

        /* ---------- المهام ---------- */
        _ensureMissionsReset() {
            const today = todayKey();
            if (!state.missions.__resetDate || state.missions.__resetDate !== today) {
                state.missions.__resetDate = today;
                MISSIONS_DEF.forEach(def => { state.missions[def.key] = { progress: 0, claimed: false }; });
                saveState();
            }
        },

        getMissions() {
            this._ensureMissionsReset();
            return MISSIONS_DEF.map(def => {
                const s = state.missions[def.key] || { progress: 0, claimed: false };
                const progress = clamp(s.progress, 0, def.target);
                return {
                    ...def, progress,
                    completed: progress >= def.target,
                    claimed: !!s.claimed,
                    percent: Math.round((progress / def.target) * 100)
                };
            });
        },

        updateMission(key, delta) {
            this._ensureMissionsReset();
            const def = MISSIONS_DEF.find(m => m.key === key);
            if (!def) return;
            if (!state.missions[key]) state.missions[key] = { progress: 0, claimed: false };
            if (state.missions[key].claimed) return;
            const before = state.missions[key].progress;
            state.missions[key].progress = Math.min(def.target, before + delta);
            saveState();
            if (before < def.target && state.missions[key].progress >= def.target) {
                emit('missionCompleted', { key, def });
            }
            emitStateChanged();
        },

        claimMission(key) {
            this._ensureMissionsReset();
            const def = MISSIONS_DEF.find(m => m.key === key);
            if (!def) return { ok: false };
            const s = state.missions[key];
            if (!s || s.progress < def.target || s.claimed) return { ok: false };
            s.claimed = true;
            this.addCoins(def.reward, `مهمة: ${def.name}`);
            saveState();
            return { ok: true, reward: def.reward };
        },

        /* ---------- الصناديق ---------- */
        getChestStatus(key) {
            const def = CHESTS_DEF[key];
            if (!def) return null;
            const s = state.chests[key] || {};
            const last = s.lastOpenTs || 0;
            const remaining = Math.max(0, (last + def.cooldownMs) - Date.now());
            return { ready: remaining === 0, remainingMs: remaining, cost: { ...def.cost } };
        },

        openChest(key) {
            const def = CHESTS_DEF[key];
            if (!def) return { ok: false };
            const st = this.getChestStatus(key);
            if (!st.ready) return { ok: false, error: 'انتظر قليلاً' };

            if (def.cost.coins && state.balance.coins < def.cost.coins) {
                return { ok: false, error: 'تحتاج ' + def.cost.coins + ' 🪙' };
            }
            if (def.cost.coins) state.balance.coins -= def.cost.coins;

            const totalWeight = def.rewards.reduce((a, r) => a + r.weight, 0);
            let roll = Math.random() * totalWeight;
            let picked = def.rewards[0];
            for (const r of def.rewards) {
                if (roll < r.weight) { picked = r; break; }
                roll -= r.weight;
            }
            const amount = randInt(picked.min, picked.max);

            if (picked.type === 'coins') this.addCoins(amount, 'صندوق');
            else if (picked.type === 'gems') this.addGems(amount, 'صندوق');
            else if (picked.type === 'xp') addXp(amount);

            if (!state.chests[key]) state.chests[key] = {};
            state.chests[key].lastOpenTs = Date.now();
            saveState();
            emitStateChanged();
            return { ok: true, reward: { type: picked.type, amount } };
        },

        /* ---------- الإحصاءات ---------- */
        recordGame(result) {
            state.totals.gamesPlayed += 1;
            if (result === 'win') {
                state.totals.wins += 1;
                ['win1', 'win5', 'win20', 'win50'].forEach(k => this.updateAchievement(k, 1));
                addXp(50);
            } else if (result === 'loss') {
                state.totals.losses += 1;
                addXp(10);
            } else {
                addXp(20);
            }
            ['play10', 'play50', 'play100'].forEach(k => this.updateAchievement(k, 1));
            saveState();
        },

        recordCapture(count = 1) {
            state.totals.captures += count;
            ['capture10', 'capture50', 'capture100'].forEach(k => this.updateAchievement(k, count));
            saveState();
        },

        resetAll() {
            state = deepClone(DEFAULT_STATE);
            saveState();
            emitBalanceChanged();
            emitStateChanged();
        }
    };

    window.RewardsSystem = RewardsSystem;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { emitBalanceChanged(); emitStateChanged(); });
    } else {
        setTimeout(() => { emitBalanceChanged(); emitStateChanged(); }, 0);
    }

    console.log('[Rewards] 🪙 نظام العملات الاحترافي جاهز!');
})();
