/* ============================================================
   rewards.js — نظام المكافآت المستقل لـ Monster Chess 3D
   يعمل مع index.html بدون تعديل أي سطر فيه.
   يوفّر واجهة: window.RewardsSystem
   ============================================================ */
(function () {
    'use strict';

    /* ---------- تخزين آمن ---------- */
    const Storage = window.SafeStorage || (function () {
        let mem = {};
        try {
            const t = '__rw_test__' + Date.now();
            localStorage.setItem(t, '1');
            localStorage.removeItem(t);
            return {
                getItem: k => { try { return localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } },
                setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
                removeItem: k => { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
            };
        } catch (e) {
            return {
                getItem: k => (k in mem) ? mem[k] : null,
                setItem: (k, v) => { mem[k] = v; },
                removeItem: k => { delete mem[k]; }
            };
        }
    })();

    const STORAGE_KEY = 'monsterChessRewards_v1';

    /* ---------- تعريفات المكافآت ---------- */
    const DAILY_REWARDS = [
        { day: 1, type: 'coins', amount: 100,  icon: '🪙' },
        { day: 2, type: 'coins', amount: 200,  icon: '🪙' },
        { day: 3, type: 'gems',  amount: 5,    icon: '💎' },
        { day: 4, type: 'coins', amount: 400,  icon: '🪙' },
        { day: 5, type: 'gems',  amount: 10,   icon: '💎' },
        { day: 6, type: 'coins', amount: 600,  icon: '🪙' },
        { day: 7, type: 'gems',  amount: 25,   icon: '💎' }
    ];

    const ACHIEVEMENTS_DEF = [
        { key: 'win1',      name: '🏅 أول فوز',            target: 1,   reward: 100, type: 'wins' },
        { key: 'win5',      name: '⚔️ محارب',              target: 5,   reward: 500, type: 'wins' },
        { key: 'win20',     name: '🔥 بطل الميدان',        target: 20,  reward: 2000, type: 'wins' },
        { key: 'capture10', name: '💀 سفاح البيادق',       target: 10,  reward: 150, type: 'captures' },
        { key: 'capture50', name: '☠️ مدمر الجيوش',        target: 50,  reward: 800, type: 'captures' },
        { key: 'play10',    name: '♟️ لاعب مخلص',          target: 10,  reward: 200, type: 'gamesPlayed' },
        { key: 'play50',    name: '🏛️ أسطورة',             target: 50,  reward: 1500, type: 'gamesPlayed' }
    ];

    const MISSIONS_DEF = [
        { key: 'play1',    name: '🎯 العب مباراة واحدة',   target: 1,  reward: 50,  type: 'gamesPlayed' },
        { key: 'win1',     name: '🏆 اربح مباراة',          target: 1,  reward: 150, type: 'wins' },
        { key: 'capture3', name: '⚔️ أسقط 3 قطع',           target: 3,  reward: 100, type: 'captures' }
    ];

    const CHESTS_DEF = {
        hero: { cost: { coins: 500 }, cooldownMs: 4 * 60 * 60 * 1000, rewards: [
            { type: 'coins', min: 200, max: 800, weight: 60 },
            { type: 'gems',  min: 2,   max: 10,  weight: 30 },
            { type: 'trophies', min: 10, max: 50, weight: 10 }
        ]}
    };

    /* ---------- الحالة الافتراضية ---------- */
    const DEFAULT_STATE = {
        balance: { coins: 500, gems: 10, trophies: 0, level: 1, xp: 0 },
        daily:   { lastClaimDate: null, streak: 0, claimedDays: [] },
        achievements: {},   // key -> { progress, claimed }
        missions:     {},   // key -> { progress, claimed, resetDate }
        chests:       {},   // key -> { lastOpenTs, pending }
        totals: { wins: 0, losses: 0, gamesPlayed: 0, captures: 0 }
    };

    /* ---------- أدوات مساعدة ---------- */
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
    const uid = () => Math.random().toString(36).slice(2, 10);

    /* ---------- تحميل/حفظ ---------- */
    let state = loadState();

    function loadState() {
        try {
            const raw = Storage.getItem(STORAGE_KEY);
            if (!raw) return deepClone(DEFAULT_STATE);
            const parsed = JSON.parse(raw);
            return mergeDeep(deepClone(DEFAULT_STATE), parsed);
        } catch (e) {
            console.warn('[Rewards] فشل التحميل، بدء من جديد', e);
            return deepClone(DEFAULT_STATE);
        }
    }

    function saveState() {
        try { Storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
        catch (e) { console.warn('[Rewards] فشل الحفظ', e); }
    }

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

    /* ---------- أحداث ---------- */
    function emit(name, detail) {
        try {
            window.dispatchEvent(new CustomEvent('rewards:' + name, { detail }));
        } catch (e) { /* ignore */ }
    }

    function emitBalanceChanged() {
        emit('balanceChanged', { ...state.balance });
    }

    function emitStateChanged() {
        emit('stateChanged', { state: deepClone(state) });
    }

    /* ---------- مستوى (XP) ---------- */
    function xpForLevel(level) {
        // منحنى بسيط: كل مستوى يحتاج 100 * level
        return 100 * level;
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
        }
        if (leveled) emitBalanceChanged();
    }

    /* ============================================================
       الواجهة العامة: window.RewardsSystem
       ============================================================ */
    const RewardsSystem = {

        /* ---------- الرصيد ---------- */
        getBalance() {
            return { ...state.balance };
        },

        addCoins(amount, reason = '') {
            if (amount <= 0) return { ok: false, error: 'مبلغ غير صالح' };
            state.balance.coins += amount;
            addXp(Math.floor(amount / 10));
            saveState();
            emitBalanceChanged();
            emit('currencyAdded', { type: 'coins', amount, reason });
            return { ok: true, balance: this.getBalance() };
        },

        addGems(amount, reason = '') {
            if (amount <= 0) return { ok: false, error: 'مبلغ غير صالح' };
            state.balance.gems += amount;
            saveState();
            emitBalanceChanged();
            emit('currencyAdded', { type: 'gems', amount, reason });
            return { ok: true, balance: this.getBalance() };
        },

        addTrophies(amount, reason = '') {
            if (amount <= 0) return { ok: false, error: 'مبلغ غير صالح' };
            state.balance.trophies += amount;
            saveState();
            emitBalanceChanged();
            emit('currencyAdded', { type: 'trophies', amount, reason });
            return { ok: true, balance: this.getBalance() };
        },

        spendCoins(amount) {
            if (amount <= 0) return { ok: false, error: 'مبلغ غير صالح' };
            if (state.balance.coins < amount) return { ok: false, error: 'لا توجد عملات كافية' };
            state.balance.coins -= amount;
            saveState();
            emitBalanceChanged();
            return { ok: true, balance: this.getBalance() };
        },

        spendGems(amount) {
            if (amount <= 0) return { ok: false, error: 'مبلغ غير صالح' };
            if (state.balance.gems < amount) return { ok: false, error: 'لا توجد جواهر كافية' };
            state.balance.gems -= amount;
            saveState();
            emitBalanceChanged();
            return { ok: true, balance: this.getBalance() };
        },

        /* ---------- المكافآت اليومية ---------- */
        getDailyStatus() {
            const today = todayKey();
            const last = state.daily.lastClaimDate;
            const gap = last ? daysBetween(last, today) : Infinity;
            let streak = state.daily.streak || 0;
            let claimedDays = [...(state.daily.claimedDays || [])];

            // إعادة تعيين إذا انقطع التسلسل
            if (gap > 1 && last !== null) {
                streak = 0;
                claimedDays = [];
            }
            if (gap === 0) {
                // استُلم اليوم بالفعل
            }

            // مؤشر اليوم الحالي (0..6)
            let currentIndex = streak % 7;
            const canClaim = (last !== today);

            const rewards = DAILY_REWARDS.map((r, i) => {
                const claimed = claimedDays.includes(i);
                const isCurrent = (i === currentIndex) && !claimed && canClaim;
                return { ...r, claimed, isCurrent };
            });

            return {
                rewards,
                streak,
                canClaim,
                currentDay: currentIndex + 1,
                totalDays: 7
            };
        },

        claimDaily(index) {
            const status = this.getDailyStatus();
            if (!status.canClaim) return { ok: false, error: 'تم الاستلام اليوم بالفعل' };
            if (index !== status.currentDay - 1) return { ok: false, error: 'هذه المكافأة غير متاحة الآن' };

            const rw = DAILY_REWARDS[index];
            if (!rw) return { ok: false, error: 'مكافأة غير صالحة' };

            // منح المكافأة
            if (rw.type === 'coins') this.addCoins(rw.amount, 'مكافأة يومية');
            else if (rw.type === 'gems') this.addGems(rw.amount, 'مكافأة يومية');

            // تحديث الحالة
            const today = todayKey();
            const gap = state.daily.lastClaimDate ? daysBetween(state.daily.lastClaimDate, today) : Infinity;
            if (gap === 1) state.daily.streak = (state.daily.streak || 0) + 1;
            else if (gap === 0) { /* لا تغيير */ }
            else state.daily.streak = 1;

            state.daily.lastClaimDate = today;
            state.daily.claimedDays = [...(state.daily.claimedDays || [])];
            if (!state.daily.claimedDays.includes(index)) state.daily.claimedDays.push(index);

            // إعادة ضبط بعد اليوم السابع
            if (state.daily.streak > 7) {
                state.daily.streak = 1;
                state.daily.claimedDays = [index];
            }

            saveState();
            emit('dailyClaimed', { day: index + 1, reward: rw });
            emitStateChanged();
            return { ok: true, reward: rw };
        },

        /* ---------- الإنجازات ---------- */
        getAchievements() {
            return ACHIEVEMENTS_DEF.map(def => {
                const s = state.achievements[def.key] || { progress: 0, claimed: false };
                const progress = clamp(s.progress, 0, def.target);
                const completed = progress >= def.target;
                return {
                    ...def,
                    progress,
                    completed,
                    claimed: !!s.claimed,
                    percent: Math.round((progress / def.target) * 100)
                };
            });
        },

        updateAchievement(key, delta) {
            const def = ACHIEVEMENTS_DEF.find(a => a.key === key);
            if (!def) return { ok: false, error: 'إنجاز غير معروف' };
            if (!state.achievements[key]) state.achievements[key] = { progress: 0, claimed: false };
            const before = state.achievements[key].progress;
            state.achievements[key].progress = Math.min(def.target, before + delta);
            saveState();
            if (before < def.target && state.achievements[key].progress >= def.target) {
                emit('achievementCompleted', { key, def });
            }
            emitStateChanged();
            return { ok: true, progress: state.achievements[key].progress };
        },

        claimAchievement(key) {
            const def = ACHIEVEMENTS_DEF.find(a => a.key === key);
            if (!def) return { ok: false, error: 'إنجاز غير معروف' };
            const s = state.achievements[key];
            if (!s) return { ok: false, error: 'لم يتم إحراز تقدم' };
            if (s.progress < def.target) return { ok: false, error: 'لم يكتمل بعد' };
            if (s.claimed) return { ok: false, error: 'تم الاستلام بالفعل' };
            s.claimed = true;
            this.addCoins(def.reward, `إنجاز: ${def.name}`);
            saveState();
            emit('achievementClaimed', { key, def });
            return { ok: true, reward: def.reward };
        },

        /* ---------- المهام اليومية ---------- */
        _ensureMissionsReset() {
            const today = todayKey();
            if (!state.missions.__resetDate || state.missions.__resetDate !== today) {
                state.missions.__resetDate = today;
                MISSIONS_DEF.forEach(def => {
                    state.missions[def.key] = { progress: 0, claimed: false };
                });
                saveState();
                emit('missionsReset', { date: today });
            }
        },

        getMissions() {
            this._ensureMissionsReset();
            return MISSIONS_DEF.map(def => {
                const s = state.missions[def.key] || { progress: 0, claimed: false };
                const progress = clamp(s.progress, 0, def.target);
                const completed = progress >= def.target;
                return {
                    ...def,
                    progress,
                    completed,
                    claimed: !!s.claimed,
                    percent: Math.round((progress / def.target) * 100)
                };
            });
        },

        updateMission(key, delta) {
            this._ensureMissionsReset();
            const def = MISSIONS_DEF.find(m => m.key === key);
            if (!def) return { ok: false, error: 'مهمة غير معروفة' };
            if (!state.missions[key]) state.missions[key] = { progress: 0, claimed: false };
            if (state.missions[key].claimed) return { ok: false, error: 'تم استلام المكافأة' };
            const before = state.missions[key].progress;
            state.missions[key].progress = Math.min(def.target, before + delta);
            saveState();
            if (before < def.target && state.missions[key].progress >= def.target) {
                emit('missionCompleted', { key, def });
            }
            emitStateChanged();
            return { ok: true, progress: state.missions[key].progress };
        },

        claimMission(key) {
            this._ensureMissionsReset();
            const def = MISSIONS_DEF.find(m => m.key === key);
            if (!def) return { ok: false, error: 'مهمة غير معروفة' };
            const s = state.missions[key];
            if (!s) return { ok: false, error: 'لم يتم إحراز تقدم' };
            if (s.progress < def.target) return { ok: false, error: 'لم تكتمل بعد' };
            if (s.claimed) return { ok: false, error: 'تم الاستلام بالفعل' };
            s.claimed = true;
            this.addCoins(def.reward, `مهمة: ${def.name}`);
            saveState();
            emit('missionClaimed', { key, def });
            return { ok: true, reward: def.reward };
        },

        /* ---------- الصناديق ---------- */
        getChestStatus(key) {
            const def = CHESTS_DEF[key];
            if (!def) return null;
            const s = state.chests[key] || {};
            const last = s.lastOpenTs || 0;
            const now = Date.now();
            const remaining = Math.max(0, (last + def.cooldownMs) - now);
            return {
                ready: remaining === 0,
                remainingMs: remaining,
                cost: { ...def.cost }
            };
        },

        openChest(key) {
            const def = CHESTS_DEF[key];
            if (!def) return { ok: false, error: 'صندوق غير معروف' };
            const st = this.getChestStatus(key);
            if (!st.ready) return { ok: false, error: 'الصندوق غير جاهز بعد' };

            // خصم التكلفة
            if (def.cost.coins) {
                const r = this.spendCoins(def.cost.coins);
                if (!r.ok) return r;
            }
            if (def.cost.gems) {
                const r = this.spendGems(def.cost.gems);
                if (!r.ok) return r;
            }

            // اختيار مكافأة عشوائية بأوزان
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
            else if (picked.type === 'trophies') this.addTrophies(amount, 'صندوق');

            // تحديث الحالة
            if (!state.chests[key]) state.chests[key] = {};
            state.chests[key].lastOpenTs = Date.now();
            saveState();
            emit('chestOpened', { key, reward: { type: picked.type, amount } });
            emitStateChanged();
            return { ok: true, reward: { type: picked.type, amount } };
        },

        /* ---------- إحصاءات ---------- */
        recordGame(result) {
            // result: 'win' | 'loss' | 'draw'
            state.totals.gamesPlayed += 1;
            if (result === 'win') {
                state.totals.wins += 1;
                this.updateAchievement('win1', 1);
                this.updateAchievement('win5', 1);
                this.updateAchievement('win20', 1);
                this.updateAchievement('play10', 0);
                this.updateAchievement('play50', 0);
                addXp(50);
            } else if (result === 'loss') {
                state.totals.losses += 1;
                addXp(10);
            }
            this.updateAchievement('play10', 1);
            this.updateAchievement('play50', 1);
            saveState();
            emitStateChanged();
            return { ok: true };
        },

        recordCapture(count = 1) {
            state.totals.captures += count;
            this.updateAchievement('capture10', count);
            this.updateAchievement('capture50', count);
            saveState();
            return { ok: true };
        },

        getTotals() {
            return { ...state.totals };
        },

        /* ---------- صيانة ---------- */
        resetAll() {
            state = deepClone(DEFAULT_STATE);
            saveState();
            emitBalanceChanged();
            emitStateChanged();
            return { ok: true };
        },

        exportState() {
            return deepClone(state);
        },

        importState(obj) {
            if (!obj || typeof obj !== 'object') return { ok: false, error: 'بيانات غير صالحة' };
            state = mergeDeep(deepClone(DEFAULT_STATE), obj);
            saveState();
            emitBalanceChanged();
            emitStateChanged();
            return { ok: true };
        },

        /* ---------- إحصاءات/تعريفات للعرض ---------- */
        _defs: {
            DAILY_REWARDS,
            ACHIEVEMENTS_DEF,
            MISSIONS_DEF,
            CHESTS_DEF
        }
    };

    /* ---------- تصدير للعالم ---------- */
    window.RewardsSystem = RewardsSystem;

    /* ---------- إطلاق أولي ---------- */
    // إبلاغ الواجهة بالرصيد المخزّن بعد تحميل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            emitBalanceChanged();
            emitStateChanged();
        }, { once: true });
    } else {
        // تأخير بسيط لضمان أن index.html جاهز
        setTimeout(() => {
            emitBalanceChanged();
            emitStateChanged();
        }, 0);
    }

    console.log('[Rewards] ✅ نظام المكافآت جاهز — window.RewardsSystem');
})();
