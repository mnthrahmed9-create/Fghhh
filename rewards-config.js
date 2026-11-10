// ═══════════════════════════════════════════════════════════════
// 🎁 نظام المكافآت - Monster Chess (ملف مستقل)
// ═══════════════════════════════════════════════════════════════
//
// 📝 للتعديل: غيّر الأرقام في القسم 1 (CONFIG) فقط
// 🚫 لا تعدل القسم 2 (ENGINE)
//
// ═══════════════════════════════════════════════════════════════

(function(){
    'use strict';

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  ⭐ القسم 1: الإعدادات (عدّل هنا فقط) ⭐                ║
    // ╚═══════════════════════════════════════════════════════════╝

    const CONFIG = {

        initialBalance: {
            coins: 2500,
            gems: 50,
            trophies: 0,
            level: 1
        },

        storageKey: 'monsterChess_rewards_v1',

        dailyRewards: [
            { day: 1, icon: '🪙', amount: 200,  type: 'coins' },
            { day: 2, icon: '🪙', amount: 400,  type: 'coins' },
            { day: 3, icon: '💎', amount: 5,    type: 'gems'  },
            { day: 4, icon: '🪙', amount: 800,  type: 'coins' },
            { day: 5, icon: '💎', amount: 10,   type: 'gems'  },
            { day: 6, icon: '🪙', amount: 1500, type: 'coins' },
            { day: 7, icon: '💎', amount: 30,   type: 'gems'  }
        ],

        chests: {
            hero: {
                name: 'صندوق الأبطال',
                icon: '🧰',
                cost: { coins: 500 },
                cooldownMs: 60 * 60 * 1000,
                loot: [
                    { type: 'coins',    min: 300, max: 1200, weight: 60 },
                    { type: 'gems',     min: 3,   max: 15,   weight: 30 },
                    { type: 'trophies', min: 20,  max: 80,   weight: 10 }
                ]
            }
        },

        achievements: {
            win1:      { name: '🐲 أول انتصار',  target: 1,  reward: 300  },
            win5:      { name: '👑 ملك الرقعة',   target: 5,  reward: 1500 },
            capture10: { name: '⚔️ سفاح',         target: 10, reward: 800  },
            play20:    { name: '🎮 محارب مثابر',  target: 20, reward: 2000 }
        },

        missions: {
            play1:    { name: '🎮 العب مباراة',  target: 1, reward: 100 },
            win1:     { name: '🏆 اربح مباراة',  target: 1, reward: 250 },
            capture3: { name: '⚔️ أسر 3 قطع',    target: 3, reward: 150 }
        }
    };

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  🚫 القسم 2: المحرك (لا تعدل) 🚫                          ║
    // ╚═══════════════════════════════════════════════════════════╝

    const Storage = (function(){
        try {
            localStorage.setItem('__rw__','1');
            localStorage.removeItem('__rw__');
            return localStorage;
        } catch(e) {
            const mem = {};
            return { getItem:k=>(k in mem?mem[k]:null), setItem:(k,v)=>{mem[k]=v;}, removeItem:k=>{delete mem[k];} };
        }
    })();

    let state = null;

    function freshState(){
        const ach = {}, mis = {};
        for (const k in CONFIG.achievements) ach[k] = { progress: 0, claimed: false };
        for (const k in CONFIG.missions)    mis[k] = { progress: 0, claimed: false };
        return {
            balance: { ...CONFIG.initialBalance },
            lastDailyClaim: '',
            dailyStreak: 0,
            achievements: ach,
            missions: mis,
            chests: {},
            createdAt: Date.now(),
            version: 1
        };
    }

    function load(){
        const raw = Storage.getItem(CONFIG.storageKey);
        if (!raw) { state = freshState(); save(); return; }
        try {
            const parsed = JSON.parse(raw);
            state = { ...freshState(), ...parsed };
            for (const k in CONFIG.achievements) {
                if (!state.achievements[k]) state.achievements[k] = { progress:0, claimed:false };
            }
            for (const k in CONFIG.missions) {
                if (!state.missions[k]) state.missions[k] = { progress:0, claimed:false };
            }
            for (const cur in CONFIG.initialBalance) {
                if (!(cur in state.balance)) state.balance[cur] = CONFIG.initialBalance[cur];
            }
        } catch(e) { state = freshState(); }
    }

    function save(){
        try { Storage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch(e){}
    }

    function emit(name, detail){
        try { window.dispatchEvent(new CustomEvent('rewards:'+name, {detail})); } catch(e){}
    }

    function notifyBalance(){ emit('balanceChanged', { ...state.balance }); }

    function addCurrency(type, amount, reason){
        if (!(type in state.balance)) return false;
        state.balance[type] = Math.max(0, state.balance[type] + amount);
        save(); notifyBalance();
        emit('currencyAdded', { type, amount, reason: reason || '' });
        return true;
    }

    function getDailyStatus(){
        const today = new Date().toDateString();
        let canClaim = state.lastDailyClaim !== today;
        if (state.dailyStreak >= CONFIG.dailyRewards.length && canClaim) {
            state.dailyStreak = 0;
            save();
        }
        return {
            canClaim,
            currentDayIndex: state.dailyStreak,
            totalDays: CONFIG.dailyRewards.length,
            rewards: CONFIG.dailyRewards.map((r,i)=>({
                ...r,
                claimed: i < state.dailyStreak,
                isCurrent: i === state.dailyStreak && canClaim
            }))
        };
    }

    function claimDaily(dayIndex){
        const status = getDailyStatus();
        if (!status.canClaim) return { ok:false, error:'تم الاستلام اليوم' };
        if (dayIndex !== status.currentDayIndex) return { ok:false, error:'ترتيب خاطئ' };
        const rw = CONFIG.dailyRewards[dayIndex];
        if (!rw) return { ok:false, error:'غير موجودة' };
        state.dailyStreak++;
        state.lastDailyClaim = new Date().toDateString();
        addCurrency(rw.type, rw.amount, 'مكافأة اليوم ' + rw.day);
        save();
        return { ok:true, reward: rw };
    }

    function canOpenChest(id){
        const chest = CONFIG.chests[id];
        if (!chest) return { ok:false, error:'غير موجود' };
        const last = state.chests[id] || 0;
        const elapsed = Date.now() - last;
        if (chest.cooldownMs > 0 && elapsed < chest.cooldownMs) {
            return { ok:false, error:'cooldown', remainingMs: chest.cooldownMs - elapsed };
        }
        for (const cur in chest.cost) {
            if ((state.balance[cur] || 0) < chest.cost[cur]) {
                return { ok:false, error:'لا تملك ' + cur + ' كافية' };
            }
        }
        return { ok:true };
    }

    function openChest(id){
        const check = canOpenChest(id);
        if (!check.ok) return check;
        const chest = CONFIG.chests[id];
        for (const cur in chest.cost) state.balance[cur] -= chest.cost[cur];
        const total = chest.loot.reduce((s,l)=>s+l.weight, 0);
        let roll = Math.random() * total;
        let chosen = chest.loot[0];
        for (const item of chest.loot) {
            roll -= item.weight;
            if (roll <= 0) { chosen = item; break; }
        }
        const amount = Math.floor(chosen.min + Math.random() * (chosen.max - chosen.min + 1));
        addCurrency(chosen.type, amount, 'صندوق ' + chest.name);
        state.chests[id] = Date.now();
        save(); notifyBalance();
        return { ok:true, reward:{ type:chosen.type, amount }, chestName: chest.name };
    }

    function getChestStatus(id){
        const chest = CONFIG.chests[id];
        if (!chest) return null;
        const last = state.chests[id] || 0;
        const remaining = chest.cooldownMs > 0 ? Math.max(0, chest.cooldownMs - (Date.now() - last)) : 0;
        return {
            id, name: chest.name, icon: chest.icon,
            cost: { ...chest.cost },
            ready: remaining === 0,
            remainingMs: remaining
        };
    }

    function updateAchievement(key, delta){
        const cfg = CONFIG.achievements[key];
        if (!cfg) return;
        const a = state.achievements[key];
        if (!a || a.progress >= cfg.target) return;
        a.progress = Math.min(cfg.target, a.progress + (delta || 1));
        save();
        emit('achievementUpdated', { key, progress: a.progress, target: cfg.target });
    }

    function claimAchievement(key){
        const cfg = CONFIG.achievements[key];
        const a = state.achievements[key];
        if (!cfg || !a) return { ok:false };
        if (a.progress < cfg.target) return { ok:false, error:'لم يكتمل' };
        if (a.claimed) return { ok:false, error:'تم استلامه' };
        a.claimed = true;
        addCurrency('coins', cfg.reward, 'إنجاز: ' + cfg.name);
        save();
        return { ok:true, reward: cfg.reward };
    }

    function getAchievements(){
        return Object.keys(CONFIG.achievements).map(key => {
            const cfg = CONFIG.achievements[key];
            const a = state.achievements[key];
            return {
                key, name: cfg.name, target: cfg.target,
                progress: a.progress, claimed: a.claimed,
                reward: cfg.reward,
                completed: a.progress >= cfg.target,
                percent: Math.min(100, (a.progress / cfg.target) * 100)
            };
        });
    }

    function updateMission(key, delta){
        const cfg = CONFIG.missions[key];
        if (!cfg) return;
        const m = state.missions[key];
        if (!m || m.progress >= cfg.target) return;
        m.progress = Math.min(cfg.target, m.progress + (delta || 1));
        save();
        emit('missionUpdated', { key, progress: m.progress, target: cfg.target });
    }

    function claimMission(key){
        const cfg = CONFIG.missions[key];
        const m = state.missions[key];
        if (!cfg || !m) return { ok:false };
        if (m.progress < cfg.target) return { ok:false, error:'لم تكتمل' };
        if (m.claimed) return { ok:false, error:'تم استلامها' };
        m.claimed = true;
        addCurrency('coins', cfg.reward, 'مهمة: ' + cfg.name);
        save();
        return { ok:true, reward: cfg.reward };
    }

    function getMissions(){
        return Object.keys(CONFIG.missions).map(key => {
            const cfg = CONFIG.missions[key];
            const m = state.missions[key];
            return {
                key, name: cfg.name, target: cfg.target,
                progress: m.progress, claimed: m.claimed,
                reward: cfg.reward,
                completed: m.progress >= cfg.target,
                percent: Math.min(100, (m.progress / cfg.target) * 100)
            };
        });
    }

    function resetAll(){
        state = freshState();
        save(); notifyBalance();
        emit('reset');
    }

    window.RewardsSystem = {
        getBalance: () => ({ ...state.balance }),
        getDailyStatus,
        getChestStatus,
        getAchievements,
        getMissions,
        addCoins: (n,r) => addCurrency('coins', n, r),
        addGems: (n,r) => addCurrency('gems', n, r),
        addTrophies: (n,r) => addCurrency('trophies', n, r),
        claimDaily,
        openChest,
        canOpenChest,
        updateAchievement,
        claimAchievement,
        updateMission,
        claimMission,
        resetAll,
        getRawState: () => JSON.parse(JSON.stringify(state)),
        config: CONFIG
    };

    load();
    notifyBalance();
    console.log('[Rewards] ✅ جاهز | الرصيد:', state.balance);

})();
