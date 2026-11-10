// ═══════════════════════════════════════════════════════════════
// 🎁 نظام المكافآت - Monster Chess
// ═══════════════════════════════════════════════════════════════
(function(){
    'use strict';

    const CONFIG = {
        initialBalance: { coins: 2500, gems: 50, trophies: 0, level: 1 },
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
                name: 'صندوق الأبطال', icon: '🧰',
                cost: { coins: 500 }, cooldownMs: 3600000,
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
            capture10: { name: '⚔️ سفاح',         target: 10, reward: 800  }
        },
        missions: {
            play1:    { name: '🎮 العب مباراة',  target: 1, reward: 100 },
            win1:     { name: '🏆 اربح مباراة',  target: 1, reward: 250 },
            capture3: { name: '⚔️ أسر 3 قطع',    target: 3, reward: 150 }
        }
    };

    const Storage = (function(){
        try { localStorage.setItem('__rw__','1'); localStorage.removeItem('__rw__'); return localStorage; } 
        catch(e) { const mem = {}; return { getItem:k=>(k in mem?mem[k]:null), setItem:(k,v)=>{mem[k]=v;} }; }
    })();

    let state = null;

    function freshState(){
        const ach = {}, mis = {};
        for (const k in CONFIG.achievements) ach[k] = { progress: 0, claimed: false };
        for (const k in CONFIG.missions)    mis[k] = { progress: 0, claimed: false };
        return { balance: { ...CONFIG.initialBalance }, lastDailyClaim: '', dailyStreak: 0, achievements: ach, missions: mis, chests: {}, version: 1 };
    }

    function load(){
        const raw = Storage.getItem(CONFIG.storageKey);
        if (!raw) { state = freshState(); save(); return; }
        try {
            state = { ...freshState(), ...JSON.parse(raw) };
            for (const k in CONFIG.achievements) if (!state.achievements[k]) state.achievements[k] = { progress:0, claimed:false };
            for (const k in CONFIG.missions)    if (!state.missions[k])    state.missions[k]    = { progress:0, claimed:false };
        } catch(e) { state = freshState(); }
    }

    function save(){ try { Storage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch(e){} }
    function emit(name, detail){ window.dispatchEvent(new CustomEvent('rewards:'+name, {detail})); }
    function notifyBalance(){ emit('balanceChanged', { ...state.balance }); }

    function addCurrency(type, amount, reason){
        if (!(type in state.balance)) return false;
        state.balance[type] = Math.max(0, state.balance[type] + amount);
        save(); notifyBalance(); emit('currencyAdded', { type, amount, reason: reason || '' });
        return true;
    }

    function getDailyStatus(){
        let canClaim = state.lastDailyClaim !== new Date().toDateString();
        if (state.dailyStreak >= CONFIG.dailyRewards.length && canClaim) { state.dailyStreak = 0; save(); }
        return { canClaim, currentDayIndex: state.dailyStreak, rewards: CONFIG.dailyRewards.map((r,i)=>({ ...r, claimed: i < state.dailyStreak, isCurrent: i === state.dailyStreak && canClaim })) };
    }

    function claimDaily(dayIndex){
        const status = getDailyStatus();
        if (!status.canClaim || dayIndex !== status.currentDayIndex) return { ok:false, error:'خطأ' };
        const rw = CONFIG.dailyRewards[dayIndex];
        state.dailyStreak++; state.lastDailyClaim = new Date().toDateString();
        addCurrency(rw.type, rw.amount, 'مكافأة اليوم ' + rw.day); save();
        return { ok:true, reward: rw };
    }

    function openChest(id){
        const chest = CONFIG.chests[id];
        if (!chest) return { ok:false };
        if (Date.now() - (state.chests[id]||0) < chest.cooldownMs) return { ok:false, error:'انتظر' };
        for (const cur in chest.cost) if ((state.balance[cur]||0) < chest.cost[cur]) return { ok:false, error:'لا تملك عملات' };
        for (const cur in chest.cost) state.balance[cur] -= chest.cost[cur];
        const total = chest.loot.reduce((s,l)=>s+l.weight, 0);
        let roll = Math.random() * total, chosen = chest.loot[0];
        for (const item of chest.loot) { roll -= item.weight; if (roll <= 0) { chosen = item; break; } }
        const amount = Math.floor(chosen.min + Math.random() * (chosen.max - chosen.min + 1));
        addCurrency(chosen.type, amount, 'صندوق'); state.chests[id] = Date.now(); save(); notifyBalance();
        return { ok:true, reward:{ type:chosen.type, amount } };
    }

    function getChestStatus(id){
        const chest = CONFIG.chests[id]; if (!chest) return null;
        const remaining = Math.max(0, chest.cooldownMs - (Date.now() - (state.chests[id]||0)));
        return { ready: remaining === 0, remainingMs: remaining, cost: chest.cost };
    }

    function updateAchievement(key, delta){
        const a = state.achievements[key]; if (a && a.progress < CONFIG.achievements[key].target) { a.progress += delta; save(); }
    }
    function claimAchievement(key){
        const a = state.achievements[key]; const cfg = CONFIG.achievements[key];
        if (!a || a.progress < cfg.target || a.claimed) return { ok:false };
        a.claimed = true; addCurrency('coins', cfg.reward, 'إنجاز'); save(); return { ok:true };
    }
    function getAchievements(){ return Object.keys(CONFIG.achievements).map(k=>({ key:k, ...CONFIG.achievements[k], progress:state.achievements[k].progress, claimed:state.achievements[k].claimed, completed:state.achievements[k].progress >= CONFIG.achievements[k].target, percent: Math.min(100, (state.achievements[k].progress / CONFIG.achievements[k].target)*100) })); }

    function updateMission(key, delta){
        const m = state.missions[key]; if (m && m.progress < CONFIG.missions[key].target) { m.progress += delta; save(); }
    }
    function claimMission(key){
        const m = state.missions[key]; const cfg = CONFIG.missions[key];
        if (!m || m.progress < cfg.target || m.claimed) return { ok:false };
        m.claimed = true; addCurrency('coins', cfg.reward, 'مهمة'); save(); return { ok:true };
    }
    function getMissions(){ return Object.keys(CONFIG.missions).map(k=>({ key:k, ...CONFIG.missions[k], progress:state.missions[k].progress, claimed:state.missions[k].claimed, completed:state.missions[k].progress >= CONFIG.missions[k].target, percent: Math.min(100, (state.missions[k].progress / CONFIG.missions[k].target)*100) })); }

    window.RewardsSystem = {
        getBalance: () => ({ ...state.balance }),
        getDailyStatus, claimDaily, openChest, getChestStatus,
        updateAchievement, claimAchievement, getAchievements,
        updateMission, claimMission, getMissions,
        addCoins: (n,r) => addCurrency('coins', n, r),
        addTrophies: (n,r) => addCurrency('trophies', n, r)
    };

    load(); notifyBalance();
})();
