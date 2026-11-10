/*!
 * Monster Chess 3D — Rewards System v1.0
 * نظام المكافآت والعملات الذهبية الاحترافي
 * مستقل تماماً — لا يحتاج تعديل أي وظيفة في اللعبة
 */
(function () {
    'use strict';

    if (window.RewardsSystem) {
        console.warn('[Rewards] Already initialized');
        return;
    }

    /* ============================================================
       CONFIG
    ============================================================ */
    const CONFIG = {
        storageKey: 'monsterChess_rewards_v1',
        checksumKey: 'monsterChess_rewards_chk',
        limits: {
            maxCoinsPerTx: 50000,
            maxBalance: 999999999,
            maxTransactions: 300,
            minClaimInterval: 400
        },
        level: {
            baseXP: 100,
            winXP: 60,
            drawXP: 25,
            lossXP: 15,
            captureXP: 8,
            coinsOnLevelUp: 300,
            gemsOnLevelUp: 3
        },
        dailyRewards: [
            { icon: '🪙', amount: 100,  type: 'coins' },
            { icon: '🪙', amount: 250,  type: 'coins' },
            { icon: '💎', amount: 3,    type: 'gems' },
            { icon: '🪙', amount: 500,  type: 'coins' },
            { icon: '🪙', amount: 800,  type: 'coins' },
            { icon: '💎', amount: 10,   type: 'gems' },
            { icon: '🏆', amount: 2000, type: 'coins' }
        ],
        missions: [
            { key: 'play1',    name: 'العب مباراة واحدة', target: 1, reward: 150 },
            { key: 'play3',    name: 'العب 3 مباريات',     target: 3, reward: 350 },
            { key: 'capture3', name: 'أسقط 3 قطع',         target: 3, reward: 200 },
            { key: 'capture8', name: 'أسقط 8 قطع',         target: 8, reward: 400 },
            { key: 'win1',     name: 'اربح مباراة',        target: 1, reward: 250 }
        ],
        achievements: [
            { key: 'win1',       name: 'أول انتصار',         icon: '🥇', target: 1,   reward: 500 },
            { key: 'win5',       name: 'محارب',              icon: '⚔️', target: 5,   reward: 1500 },
            { key: 'win20',      name: 'فاتح',               icon: '👑', target: 20,  reward: 5000 },
            { key: 'capture10',  name: 'صياد',               icon: '🎯', target: 10,  reward: 400 },
            { key: 'capture100', name: 'مذعور',              icon: '💀', target: 100, reward: 3000 },
            { key: 'streak3',    name: 'سلسلة 3 انتصارات',   icon: '🔥', target: 3,   reward: 1000 },
            { key: 'streak7',    name: 'سلسلة 7 انتصارات',   icon: '🌟', target: 7,   reward: 5000 }
        ],
        chests: {
            hero: {
                name: 'صندوق الأبطال',
                cooldown: 4 * 60 * 60 * 1000,
                cost: { coins: 500 },
                rewards: [
                    { amount: 200,  type: 'coins',    weight: 40 },
                    { amount: 500,  type: 'coins',    weight: 25 },
                    { amount: 1000, type: 'coins',    weight: 15 },
                    { amount: 2500, type: 'coins',    weight: 8 },
                    { amount: 3,    type: 'gems',     weight: 8 },
                    { amount: 10,   type: 'gems',     weight: 3 },
                    { amount: 50,   type: 'trophies', weight: 1 }
                ]
            }
        },
        store: [
            { id: 'dragon_gold',    name: '🐲 تنين ذهبي',      price: 2500, category: 'skin' },
            { id: 'ghoul_dark',     name: '👹 غول الظلام',     price: 1800, category: 'skin' },
            { id: 'king_board',     name: '🧿 رقعة الملك',      price: 3000, category: 'board' },
            { id: 'phoenix_flame',  name: '🔥 عنقاء اللهب',     price: 4000, category: 'skin' },
            { id: 'crystal_board',  name: '💎 رقعة كريستالية',  price: 5000, category: 'board' },
            { id: 'golden_monster', name: '🦁 وحش ذهبي',       price: 3500, category: 'skin' }
        ],
        supabase: {
            enabled: false,
            url: '',
            anonKey: '',
            table: 'player_rewards',
            playerIdKey: 'monsterChess_playerId'
        }
    };

    /* ============================================================
       STORAGE (SafeStorage when available, else raw localStorage)
    ============================================================ */
    const Storage = {
        getItem(k) {
            try { if (window.SafeStorage) return window.SafeStorage.getItem(k); } catch (e) {}
            try { return localStorage.getItem(k); } catch (e) { return null; }
        },
        setItem(k, v) {
            try { if (window.SafeStorage) { window.SafeStorage.setItem(k, v); return; } } catch (e) {}
            try { localStorage.setItem(k, v); } catch (e) {}
        },
        removeItem(k) {
            try { if (window.SafeStorage) { window.SafeStorage.removeItem(k); return; } } catch (e) {}
            try { localStorage.removeItem(k); } catch (e) {}
        }
    };

    /* ============================================================
       STATE
    ============================================================ */
    let state = null;
    let supabaseClient = null;
    let saveTimer = null;
    let lastClaimTime = 0;

    function defaultState() {
        return {
            version: 1,
            coins: 500,
            gems: 0,
            trophies: 0,
            xp: 0,
            stats: {
                wins: 0, losses: 0, draws: 0, captures: 0,
                currentStreak: 0, bestStreak: 0,
                totalEarned: 0, totalSpent: 0
            },
            daily: { lastClaimDate: null, streak: 0 },
            lastMissionReset: null,
            achievements: {},
            missions: {},
            chests: {},
            ownedItems: [],
            transactions: [],
            createdAt: Date.now(),
            lastSaved: Date.now()
        };
    }

    function loadState() {
        const raw = Storage.getItem(CONFIG.storageKey);
        if (!raw) return defaultState();
        try {
            const parsed = JSON.parse(raw);
            const def = defaultState();
            // shallow merge with defaults for safety
            const merged = Object.assign({}, def, parsed);
            merged.stats = Object.assign({}, def.stats, parsed.stats || {});
            merged.daily = Object.assign({}, def.daily, parsed.daily || {});
            merged.achievements = parsed.achievements || {};
            merged.missions = parsed.missions || {};
            merged.chests = parsed.chests || {};
            merged.ownedItems = Array.isArray(parsed.ownedItems) ? parsed.ownedItems : [];
            merged.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
            return merged;
        } catch (e) {
            console.warn('[Rewards] Corrupt state, resetting:', e);
            return defaultState();
        }
    }

    function saveState(immediate) {
        if (!state) return;
        state.lastSaved = Date.now();
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        const doSave = () => {
            try {
                const json = JSON.stringify(state);
                Storage.setItem(CONFIG.storageKey, json);
                Storage.setItem(CONFIG.checksumKey, hash32(json));
            } catch (e) { /* quota */ }
            if (CONFIG.supabase.enabled) syncToSupabase();
        };
        if (immediate) doSave();
        else saveTimer = setTimeout(doSave, 80);
    }

    function verifyChecksum() {
        const raw = Storage.getItem(CONFIG.storageKey);
        const chk = Storage.getItem(CONFIG.checksumKey);
        if (!raw || !chk) return;
        if (hash32(raw) !== chk) {
            console.warn('[Rewards] Checksum mismatch — possible manual edit');
        }
    }

    function hash32(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16);
    }

    /* ============================================================
       EVENTS
    ============================================================ */
    function emit(name, detail) {
        try {
            window.dispatchEvent(new CustomEvent('rewards:' + name, { detail: detail || null }));
        } catch (e) {}
    }

    /* ============================================================
       HELPERS
    ============================================================ */
    function todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function yesterdayStr() {
        const d = new Date(Date.now() - 86400000);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function uid() {
        return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    /* ============================================================
       CURRENCY (low-level)
    ============================================================ */
    function _addCurrencyDirect(type, amount, reason, silent) {
        if (!Number.isFinite(amount) || amount <= 0) return;
        if (amount > CONFIG.limits.maxCoinsPerTx) {
            console.warn('[Rewards] Amount too large, capped:', amount);
            amount = CONFIG.limits.maxCoinsPerTx;
        }
        if (type === 'coins') {
            state.coins = Math.min(state.coins + amount, CONFIG.limits.maxBalance);
            state.stats.totalEarned += amount;
        } else if (type === 'gems') {
            state.gems = Math.min(state.gems + amount, CONFIG.limits.maxBalance);
        } else if (type === 'trophies') {
            state.trophies = Math.min(state.trophies + amount, CONFIG.limits.maxBalance);
        } else {
            return;
        }
        addTransaction(type, amount, reason, 'in');
        saveState();
        emit('balanceChanged', getBalance());
        emit('stateChanged');
        if (!silent) emit('currencyAdded', { type, amount, reason });
    }

    function _removeCurrencyDirect(type, amount, reason) {
        if (type === 'coins') state.coins = Math.max(0, state.coins - amount);
        else if (type === 'gems') state.gems = Math.max(0, state.gems - amount);
        else if (type === 'trophies') state.trophies = Math.max(0, state.trophies - amount);
        state.stats.totalSpent += amount;
        addTransaction(type, -amount, reason, 'out');
        saveState();
        emit('balanceChanged', getBalance());
        emit('stateChanged');
    }

    function _grantRewardInternal(type, amount, reason) {
        _addCurrencyDirect(type, amount, reason, /*silent*/ true);
    }

    function addTransaction(type, amount, reason, dir) {
        const tx = {
            id: uid(),
            type,
            amount,
            reason: reason || '',
            dir: dir || (amount > 0 ? 'in' : 'out'),
            balanceAfter: type === 'coins' ? state.coins : type === 'gems' ? state.gems : state.trophies,
            timestamp: Date.now()
        };
        state.transactions.unshift(tx);
        if (state.transactions.length > CONFIG.limits.maxTransactions) {
            state.transactions.length = CONFIG.limits.maxTransactions;
        }
    }

    function addCoins(amount, reason) {
        _addCurrencyDirect('coins', amount, reason, false);
    }
    function addGems(amount, reason) {
        _addCurrencyDirect('gems', amount, reason, false);
    }
    function addTrophies(amount, reason) {
        _addCurrencyDirect('trophies', amount, reason, false);
    }
    function spendCoins(amount, reason) {
        if (!Number.isFinite(amount) || amount <= 0) return false;
        if (state.coins < amount) return false;
        _removeCurrencyDirect('coins', amount, reason);
        return true;
    }

    /* ============================================================
       LEVEL / XP
    ============================================================ */
    function cumulativeXP(level) {
        return CONFIG.level.baseXP * (level - 1) * level / 2;
    }
    function levelFromXP(xp) {
        let lvl = 1;
        while (cumulativeXP(lvl + 1) <= xp) lvl++;
        return lvl;
    }
    function getLevelInfo() {
        const lvl = levelFromXP(state.xp);
        const curBase = cumulativeXP(lvl);
        const nextBase = cumulativeXP(lvl + 1);
        return {
            level: lvl,
            xp: state.xp - curBase,
            xpNeeded: nextBase - curBase,
            xpTotal: state.xp,
            percent: Math.round(((state.xp - curBase) / (nextBase - curBase)) * 100)
        };
    }
    function addXP(amount) {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const before = levelFromXP(state.xp);
        state.xp += amount;
        const after = levelFromXP(state.xp);
        if (after > before) {
            _grantRewardInternal('coins', CONFIG.level.coinsOnLevelUp, 'ترقية المستوى ' + after);
            _grantRewardInternal('gems', CONFIG.level.gemsOnLevelUp, 'ترقية المستوى ' + after);
            emit('levelUp', { level: after });
        }
        saveState();
        emit('stateChanged');
    }

    /* ============================================================
       ACHIEVEMENTS
    ============================================================ */
    function ensureAchievements() {
        CONFIG.achievements.forEach(def => {
            if (!state.achievements[def.key]) {
                state.achievements[def.key] = { progress: 0, claimed: false, completed: false };
            }
        });
    }
    function updateAchievement(key, amount) {
        const def = CONFIG.achievements.find(a => a.key === key);
        if (!def) return;
        ensureAchievements();
        const ach = state.achievements[key];
        ach.progress += amount;
        if (!ach.completed && ach.progress >= def.target) {
            ach.completed = true;
            emit('achievementCompleted', { def: Object.assign({ key }, def) });
        }
        saveState();
        emit('stateChanged');
    }
    function setAchievementProgress(key, value) {
        const def = CONFIG.achievements.find(a => a.key === key);
        if (!def) return;
        ensureAchievements();
        const ach = state.achievements[key];
        if (value > ach.progress) ach.progress = value;
        if (!ach.completed && ach.progress >= def.target) {
            ach.completed = true;
            emit('achievementCompleted', { def: Object.assign({ key }, def) });
        }
        saveState();
        emit('stateChanged');
    }
    function getAchievements() {
        ensureAchievements();
        return CONFIG.achievements.map(def => {
            const ach = state.achievements[def.key];
            return {
                key: def.key,
                name: def.icon + ' ' + def.name,
                target: def.target,
                reward: def.reward,
                progress: Math.min(ach.progress, def.target),
                completed: !!ach.completed,
                claimed: !!ach.claimed,
                percent: Math.min(100, Math.round((ach.progress / def.target) * 100))
            };
        });
    }
    function claimAchievement(key) {
        const now = Date.now();
        if (now - lastClaimTime < CONFIG.limits.minClaimInterval) return { ok: false, error: 'الرجاء الانتظار قليلاً' };
        const def = CONFIG.achievements.find(a => a.key === key);
        if (!def) return { ok: false, error: 'إنجاز غير معروف' };
        const ach = state.achievements[key];
        if (!ach || !ach.completed) return { ok: false, error: 'لم يكتمل الإنجاز' };
        if (ach.claimed) return { ok: false, error: 'تم استلام المكافأة مسبقاً' };
        lastClaimTime = now;
        ach.claimed = true;
        _grantRewardInternal('coins', def.reward, 'مكافأة إنجاز: ' + def.name);
        saveState();
        return { ok: true, reward: def.reward };
    }

    /* ============================================================
       MISSIONS
    ============================================================ */
    function ensureMissions() {
        CONFIG.missions.forEach(def => {
            if (!state.missions[def.key]) {
                state.missions[def.key] = { progress: 0, claimed: false, completed: false };
            }
        });
    }
    function resetMissionsIfNeeded() {
        const today = todayStr();
        if (state.lastMissionReset !== today) {
            state.lastMissionReset = today;
            state.missions = {};
            ensureMissions();
            saveState(true);
        }
    }
    function updateMission(key, amount) {
        const def = CONFIG.missions.find(m => m.key === key);
        if (!def) return;
        ensureMissions();
        const mis = state.missions[key];
        mis.progress += amount;
        if (!mis.completed && mis.progress >= def.target) {
            mis.completed = true;
            emit('missionCompleted', { def: Object.assign({ key }, def) });
        }
        saveState();
        emit('stateChanged');
    }
    function getMissions() {
        ensureMissions();
        return CONFIG.missions.map(def => {
            const mis = state.missions[def.key];
            return {
                key: def.key,
                name: def.name,
                target: def.target,
                reward: def.reward,
                progress: Math.min(mis.progress, def.target),
                completed: !!mis.completed,
                claimed: !!mis.claimed,
                percent: Math.min(100, Math.round((mis.progress / def.target) * 100))
            };
        });
    }
    function claimMission(key) {
        const now = Date.now();
        if (now - lastClaimTime < CONFIG.limits.minClaimInterval) return { ok: false, error: 'الرجاء الانتظار قليلاً' };
        const def = CONFIG.missions.find(m => m.key === key);
        if (!def) return { ok: false, error: 'مهمة غير معروفة' };
        const mis = state.missions[key];
        if (!mis || !mis.completed) return { ok: false, error: 'لم تكتمل المهمة' };
        if (mis.claimed) return { ok: false, error: 'تم استلام المكافأة مسبقاً' };
        lastClaimTime = now;
        mis.claimed = true;
        _grantRewardInternal('coins', def.reward, 'مكافأة مهمة: ' + def.name);
        saveState();
        return { ok: true, reward: def.reward };
    }

    /* ============================================================
       DAILY REWARDS
    ============================================================ */
    function checkDailyStreakReset() {
        const today = todayStr();
        const yesterday = yesterdayStr();
        if (state.daily.lastClaimDate &&
            state.daily.lastClaimDate !== today &&
            state.daily.lastClaimDate !== yesterday) {
            state.daily.streak = 0;
            saveState();
        }
    }
    function getDailyStatus() {
        checkDailyStreakReset();
        resetMissionsIfNeeded();
        const today = todayStr();
        const canClaim = state.daily.lastClaimDate !== today;
        const streak = state.daily.streak % 7;
        const rewards = CONFIG.dailyRewards.map((rw, i) => ({
            day: i + 1,
            icon: rw.icon,
            amount: rw.amount,
            type: rw.type,
            claimed: i < streak,
            isCurrent: i === streak && canClaim
        }));
        return { rewards, canClaim, streak };
    }
    function claimDaily(index) {
        const today = todayStr();
        if (state.daily.lastClaimDate === today) return { ok: false, error: 'تم استلام مكافأة اليوم' };
        const streak = state.daily.streak % 7;
        if (index !== streak) return { ok: false, error: 'اليوم غير صالح' };
        const now = Date.now();
        if (now - lastClaimTime < CONFIG.limits.minClaimInterval) return { ok: false, error: 'الرجاء الانتظار قليلاً' };
        lastClaimTime = now;
        const rw = CONFIG.dailyRewards[index];
        if (!rw) return { ok: false, error: 'مكافأة غير صالحة' };
        _grantRewardInternal(rw.type, rw.amount, 'المكافأة اليومية - اليوم ' + (index + 1));
        state.daily.lastClaimDate = today;
        state.daily.streak = (state.daily.streak + 1) % 7;
        saveState();
        return { ok: true, reward: { amount: rw.amount, type: rw.type } };
    }

    /* ============================================================
       CHESTS
    ============================================================ */
    function getChestStatus(type) {
        const def = CONFIG.chests[type];
        if (!def) return null;
        const rec = state.chests[type] || { lastOpened: 0 };
        const remainingMs = Math.max(0, (rec.lastOpened + def.cooldown) - Date.now());
        return {
            ready: remainingMs === 0,
            remainingMs,
            cost: def.cost || { coins: 0 }
        };
    }
    function _pickChestReward(def) {
        const total = def.rewards.reduce((s, r) => s + r.weight, 0);
        let roll = Math.random() * total;
        for (const r of def.rewards) {
            roll -= r.weight;
            if (roll <= 0) return r;
        }
        return def.rewards[def.rewards.length - 1];
    }
    function openChest(type) {
        const def = CONFIG.chests[type];
        if (!def) return { ok: false, error: 'صندوق غير معروف' };
        const status = getChestStatus(type);
        if (!status.ready) return { ok: false, error: 'الصندوق غير جاهز' };
        const cost = (def.cost && def.cost.coins) || 0;
        if (state.coins < cost) return { ok: false, error: 'رصيد غير كافٍ' };
        if (cost > 0) _removeCurrencyDirect('coins', cost, 'فتح ' + def.name);
        const reward = _pickChestReward(def);
        _grantRewardInternal(reward.type, reward.amount, 'مكافأة صندوق');
        state.chests[type] = { lastOpened: Date.now() };
        saveState();
        return { ok: true, reward: { amount: reward.amount, type: reward.type } };
    }

    /* ============================================================
       STORE
    ============================================================ */
    function ownsItem(id) {
        return state.ownedItems.indexOf(id) !== -1;
    }
    function getStoreItems() {
        return CONFIG.store.map(item => Object.assign({}, item, {
            owned: ownsItem(item.id),
            canAfford: state.coins >= item.price
        }));
    }
    function purchaseItem(id) {
        const item = CONFIG.store.find(x => x.id === id);
        if (!item) return { ok: false, error: 'عنصر غير معروف' };
        if (ownsItem(id)) return { ok: false, error: 'تملك هذا العنصر مسبقاً' };
        if (state.coins < item.price) return { ok: false, error: 'رصيد غير كافٍ' };
        _removeCurrencyDirect('coins', item.price, 'شراء ' + item.name);
        state.ownedItems.push(id);
        saveState();
        return { ok: true, item };
    }

    /* ============================================================
       GAME RECORDING
    ============================================================ */
    function recordGame(result) {
        if (result === 'win') {
            state.stats.wins++;
            state.stats.currentStreak++;
            state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.currentStreak);
            addXP(CONFIG.level.winXP);
            // streak achievements use bestStreak
            setAchievementProgress('streak3', state.stats.bestStreak);
            setAchievementProgress('streak7', state.stats.bestStreak);
        } else if (result === 'loss') {
            state.stats.losses++;
            state.stats.currentStreak = 0;
            addXP(CONFIG.level.lossXP);
        } else if (result === 'draw') {
            state.stats.draws++;
            addXP(CONFIG.level.drawXP);
        }
        saveState();
        emit('stateChanged');
    }
    function recordCapture(n) {
        state.stats.captures += n;
        addXP(CONFIG.level.captureXP * n);
        saveState();
        emit('stateChanged');
    }

    /* ============================================================
       BALANCE
    ============================================================ */
    function getBalance() {
        return {
            coins: state.coins,
            gems: state.gems,
            trophies: state.trophies,
            level: levelFromXP(state.xp)
        };
    }
    function getTransactions(limit) {
        const n = limit || 30;
        return state.transactions.slice(0, n);
    }

    /* ============================================================
       SUPABASE (optional)
    ============================================================ */
    function configureSupabase(cfg) {
        if (!cfg || !cfg.url || !cfg.anonKey) return false;
        CONFIG.supabase = Object.assign(CONFIG.supabase, cfg, { enabled: true });
        try {
            if (window.supabase && window.supabase.createClient) {
                supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
                loadFromSupabase();
                return true;
            }
        } catch (e) { console.warn('[Rewards] Supabase init failed', e); }
        return false;
    }
    async function syncToSupabase() {
        if (!supabaseClient) return;
        try {
            const playerId = Storage.getItem(CONFIG.supabase.playerIdKey) || (() => {
                const id = 'player_' + Math.random().toString(36).slice(2);
                Storage.setItem(CONFIG.supabase.playerIdKey, id);
                return id;
            })();
            await supabaseClient.from(CONFIG.supabase.table).upsert({
                player_id: playerId,
                state: state,
                updated_at: new Date().toISOString()
            }, { onConflict: 'player_id' });
        } catch (e) { /* offline is fine */ }
    }
    async function loadFromSupabase() {
        if (!supabaseClient) return;
        try {
            const playerId = Storage.getItem(CONFIG.supabase.playerIdKey);
            if (!playerId) return;
            const { data } = await supabaseClient.from(CONFIG.supabase.table)
                .select('state').eq('player_id', playerId).maybeSingle();
            if (data && data.state) {
                // Only accept remote if it has more total earned (higher trust)
                if ((data.state.stats && data.state.stats.totalEarned || 0) >= (state.stats.totalEarned || 0)) {
                    state = Object.assign(defaultState(), data.state);
                    saveState(true);
                    emit('balanceChanged', getBalance());
                    emit('stateChanged');
                }
            }
        } catch (e) { /* offline */ }
    }

    /* ============================================================
       UI — CSS INJECTION
    ============================================================ */
    function injectCSS() {
        if (document.getElementById('rewards-css')) return;
        const style = document.createElement('style');
        style.id = 'rewards-css';
        style.textContent = `
/* Coin animations */
@keyframes rwCoinFly {
    0%   { transform: translate(var(--sx), var(--sy)) scale(0.4) rotate(0deg); opacity: 0; }
    15%  { transform: translate(calc(var(--sx) * 0.7), calc(var(--sy) - 60px)) scale(1.3) rotate(180deg); opacity: 1; }
    100% { transform: translate(var(--ex), var(--ey)) scale(0.4) rotate(720deg); opacity: 0; }
}
@keyframes rwCoinBurst {
    0%   { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
    20%  { transform: translate(calc(var(--bx) * 0.4), calc(var(--by) * 0.4)) scale(1.4) rotate(180deg); opacity: 1; }
    100% { transform: translate(var(--bx), var(--by)) scale(0.5) rotate(720deg); opacity: 0; }
}
@keyframes rwPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.4); color: #FFD700; filter: drop-shadow(0 0 6px #FFD700); }
    100% { transform: scale(1); }
}
@keyframes rwCoinSpin {
    0% { transform: rotateY(0deg); }
    100% { transform: rotateY(360deg); }
}
.rw-pulse { animation: rwPulse 0.6s ease; }
.rw-flying-coin, .rw-burst-coin {
    position: fixed; z-index: 99999; pointer-events: none;
    font-size: 32px; user-select: none;
    will-change: transform, opacity;
}
.rw-flying-coin { animation: rwCoinFly 0.85s cubic-bezier(0.4, 0, 0.6, 1) forwards; }
.rw-burst-coin  { animation: rwCoinBurst 1.6s cubic-bezier(0.3, 0, 0.5, 1) forwards; }
.rw-3d-coin {
    width: 96px; height: 96px; margin: 0 auto 14px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #FFE58A 0%, #D4AF37 45%, #8B6914 100%);
    box-shadow: 0 0 30px rgba(212,175,55,0.55), inset 0 -6px 16px rgba(0,0,0,0.4), inset 0 6px 12px rgba(255,255,255,0.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 44px; color: #5a3f0a; text-shadow: 0 2px 0 #FFE58A;
    animation: rwCoinSpin 3.5s linear infinite;
}
.rw-wallet-balance {
    display: flex; justify-content: space-around; gap: 8px;
    padding: 12px; margin-bottom: 12px;
    background: rgba(10,15,25,0.55); border: 1.5px solid rgba(201,169,106,0.35);
    border-radius: 14px;
}
.rw-wallet-balance .item { text-align: center; flex: 1; }
.rw-wallet-balance .item b { display: block; font-size: 16px; color: #C9A96A; margin-top: 4px; }
.rw-wallet-balance .item small { font-size: 10px; color: #8A919C; }
.rw-tx {
    display: flex; justify-content: space-between; align-items: center;
    padding: 9px 11px; margin-bottom: 6px;
    background: rgba(10,15,25,0.5);
    border-radius: 10px; border: 1px solid rgba(201,169,106,0.15);
    font-size: 12px; color: #F2EAD9;
}
.rw-tx .tx-amt.pos { color: #7BE0A0; font-weight: 900; }
.rw-tx .tx-amt.neg { color: #B97C6E; font-weight: 900; }
.rw-tx .tx-time { font-size: 10px; color: #8A919C; margin-top: 2px; }
.rw-store-item {
    background: rgba(10,15,25,0.55); border: 1.5px solid rgba(201,169,106,0.25);
    border-radius: 12px; padding: 11px; margin-bottom: 8px;
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
}
.rw-store-item.owned { opacity: 0.55; }
.rw-store-item .info { flex: 1; }
.rw-store-item .info b { font-size: 13px; color: #F2EAD9; }
.rw-store-item .info small { display: block; font-size: 10px; color: #8A919C; margin-top: 3px; }
.rw-store-item .price { color: #C9A96A; font-weight: 900; font-size: 12px; white-space: nowrap; }
.rw-btn {
    background: linear-gradient(180deg, var(--champagne-light, #D9C08E), var(--champagne-dark, #A8894F));
    color: #1A1A1E; border: 1.5px solid rgba(242,234,217,0.6);
    border-radius: 10px; padding: 6px 14px;
    font-family: 'Cairo', sans-serif; font-weight: 900; font-size: 11px;
    cursor: pointer;
}
.rw-btn:active { transform: scale(0.95); }
.rw-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.rw-btn.ghost {
    background: rgba(10,15,25,0.6); color: #C9A96A;
    border-color: rgba(201,169,106,0.4);
}
`;
        document.head.appendChild(style);
    }

    /* ============================================================
       UI — WALLET MODAL (injected)
    ============================================================ */
    function injectWalletModal() {
        if (document.getElementById('modal-wallet-r')) return;
        const div = document.createElement('div');
        div.className = 'modal-overlay';
        div.id = 'modal-wallet-r';
        div.innerHTML = `
            <div class="modal-content">
                <h2>💰 المحفظة</h2>
                <div class="rw-3d-coin">🪙</div>
                <div class="rw-wallet-balance" id="rw-wallet-balance"></div>
                <div class="modal-section-title">📜 سجل العمليات</div>
                <div id="rw-wallet-history" style="max-height:280px;overflow-y:auto;"></div>
                <button class="modal-close" onclick="document.getElementById('modal-wallet-r').classList.remove('active')">إغلاق</button>
            </div>`;
        div.addEventListener('click', e => { if (e.target === div) div.classList.remove('active'); });
        document.body.appendChild(div);
    }

    function renderWallet() {
        const bal = getBalance();
        const balEl = document.getElementById('rw-wallet-balance');
        if (balEl) {
            balEl.innerHTML = `
                <div class="item"><span style="font-size:20px">🪙</span><b>${bal.coins.toLocaleString()}</b><small>عملات</small></div>
                <div class="item"><span style="font-size:20px">💎</span><b>${bal.gems.toLocaleString()}</b><small>جواهر</small></div>
                <div class="item"><span style="font-size:20px">⭐</span><b>${bal.trophies.toLocaleString()}</b><small>كؤوس</small></div>
                <div class="item"><span style="font-size:20px">🏅</span><b>${bal.level}</b><small>مستوى</small></div>`;
        }
        const hist = document.getElementById('rw-wallet-history');
        if (hist) {
            const txs = getTransactions(50);
            if (!txs.length) {
                hist.innerHTML = '<p style="text-align:center;color:#8A919C;padding:20px;">لا توجد عمليات بعد</p>';
            } else {
                const icons = { coins: '🪙', gems: '💎', trophies: '⭐' };
                hist.innerHTML = txs.map(tx => {
                    const sign = tx.amount >= 0 ? '+' : '';
                    const cls = tx.amount >= 0 ? 'pos' : 'neg';
                    const d = new Date(tx.timestamp);
                    const time = d.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
                    return `<div class="rw-tx">
                        <div>
                            <div>${tx.reason || '—'}</div>
                            <div class="tx-time">${time}</div>
                        </div>
                        <div class="tx-amt ${cls}">${sign}${tx.amount} ${icons[tx.type] || ''}</div>
                    </div>`;
                }).join('');
            }
        }
    }

    function openWallet() {
        const m = document.getElementById('modal-wallet-r');
        if (!m) return;
        renderWallet();
        m.classList.add('active');
    }

    /* ============================================================
       UI — STORE RENDERER
    ============================================================ */
    function renderStoreModal() {
        const modal = document.getElementById('modal-store');
        if (!modal) return;
        const content = modal.querySelector('.modal-content');
        if (!content) return;
        const items = getStoreItems();
        const bal = state.coins;
        const itemsHtml = items.map(item => {
            const catIcon = item.category === 'skin' ? '🎭' : '🎨';
            let btn;
            if (item.owned) btn = `<button class="rw-btn" disabled>مملوك ✓</button>`;
            else if (!item.canAfford) btn = `<button class="rw-btn" disabled>رصيد غير كافٍ</button>`;
            else btn = `<button class="rw-btn" data-buy="${item.id}">شراء</button>`;
            return `<div class="rw-store-item ${item.owned ? 'owned' : ''}">
                <div class="info">
                    <b>${item.name}</b>
                    <small>${catIcon} ${item.category}</small>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
                    <span class="price">🪙 ${item.price.toLocaleString()}</span>
                    ${btn}
                </div>
            </div>`;
        }).join('');

        content.innerHTML = `
            <h2>🏪 المتجر</h2>
            <p style="text-align:center;color:#C4C9D1;font-size:12px;margin-bottom:10px;">
                رصيدك: 🪙 <b style="color:#C9A96A;">${bal.toLocaleString()}</b>
            </p>
            ${itemsHtml}
            <button class="rw-btn ghost" style="width:100%;margin-top:8px;" onclick="document.getElementById('modal-store').classList.remove('active');RewardsSystem.openWallet();">💰 عرض المحفظة</button>
            <button class="modal-close" onclick="document.getElementById('modal-store').classList.remove('active')">إغلاق</button>
        `;

        content.querySelectorAll('[data-buy]').forEach(btn => {
            btn.addEventListener('click', () => {
                const res = purchaseItem(btn.dataset.buy);
                if (res.ok) {
                    showCoinBurst();
                    toast('🛒 تم شراء: ' + res.item.name);
                    renderStoreModal();
                } else {
                    toast('❌ ' + res.error);
                }
            });
        });
    }

    function setupStoreObserver() {
        const modal = document.getElementById('modal-store');
        if (!modal) return;
        const obs = new MutationObserver(() => {
            if (modal.classList.contains('active')) renderStoreModal();
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    /* ============================================================
       UI — COIN EFFECTS
    ============================================================ */
    function showFlyingCoin(targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;
        const tr = target.getBoundingClientRect();
        const coin = document.createElement('div');
        coin.className = 'rw-flying-coin';
        coin.textContent = '🪙';
        coin.style.left = '50%';
        coin.style.top = '40%';
        coin.style.setProperty('--sx', '0px');
        coin.style.setProperty('--sy', '0px');
        coin.style.setProperty('--ex', (tr.left + tr.width / 2 - window.innerWidth / 2) + 'px');
        coin.style.setProperty('--ey', (tr.top + tr.height / 2 - window.innerHeight * 0.4) + 'px');
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), 900);
    }

    function showCoinBurst() {
        const count = 32;
        const burst = document.createElement('div');
        burst.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;';
        for (let i = 0; i < count; i++) {
            const c = document.createElement('div');
            c.className = 'rw-burst-coin';
            c.textContent = i % 5 === 0 ? '💎' : '🪙';
            const angle = Math.random() * Math.PI * 2;
            const dist = 120 + Math.random() * 350;
            c.style.left = '50%';
            c.style.top = '45%';
            c.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
            c.style.setProperty('--by', Math.sin(angle) * dist + 'px');
            c.style.animationDelay = (Math.random() * 0.25) + 's';
            burst.appendChild(c);
        }
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 2200);
    }

    function toast(msg) {
        if (typeof window.showToast === 'function') {
            try { window.showToast(msg); return; } catch (e) {}
        }
        console.log('[Rewards]', msg);
    }

    /* ============================================================
       UI — AUTO ANIMATIONS ON BALANCE CHANGE
    ============================================================ */
    let _lastCoins = null;
    let _lastGems = null;

    function onBalanceChanged(bal) {
        const coinsEl = document.getElementById('ui-coins');
        const gemsEl = document.getElementById('ui-gems');
        if (_lastCoins !== null && bal.coins > _lastCoins && coinsEl) {
            coinsEl.classList.remove('rw-pulse');
            void coinsEl.offsetWidth;
            coinsEl.classList.add('rw-pulse');
            showFlyingCoin('ui-coins');
        }
        if (_lastGems !== null && bal.gems > _lastGems && gemsEl) {
            gemsEl.classList.remove('rw-pulse');
            void gemsEl.offsetWidth;
            gemsEl.classList.add('rw-pulse');
        }
        _lastCoins = bal.coins;
        _lastGems = bal.gems;
        // Update wallet if open
        const wallet = document.getElementById('modal-wallet-r');
        if (wallet && wallet.classList.contains('active')) renderWallet();
    }

    /* ============================================================
       UI — EXPOSE
    ============================================================ */
    function setupDOM() {
        injectCSS();
        injectWalletModal();
        setupStoreObserver();

        // Coin pill click -> wallet
        const coinPill = document.querySelector('.res-pill.coin');
        if (coinPill) {
            coinPill.addEventListener('click', (e) => {
                if (e.target.classList && e.target.classList.contains('btn-plus')) return;
                openWallet();
            });
        }

        // Initial sync of balance display
        emit('balanceChanged', getBalance());
    }

    /* ============================================================
       PUBLIC API
    ============================================================ */
    window.RewardsSystem = {
        VERSION: '1.0.0',
        CONFIG,
        // Read
        getBalance,
        getLevelInfo,
        getDailyStatus,
        getAchievements,
        getMissions,
        getChestStatus,
        getStoreItems,
        getTransactions,
        ownsItem,
        // Actions
        claimDaily,
        claimAchievement,
        claimMission,
        openChest,
        purchaseItem,
        openWallet,
        // Recording
        recordGame,
        recordCapture,
        updateMission,
        updateAchievement,
        // Currency
        addCoins, addGems, addTrophies, spendCoins, addXP,
        // Supabase
        configureSupabase,
        // Debug
        _export: () => JSON.parse(JSON.stringify(state)),
        _import: (s) => { state = Object.assign(defaultState(), s); saveState(true); emit('balanceChanged', getBalance()); emit('stateChanged'); },
        _reset: () => { state = defaultState(); ensureAchievements(); ensureMissions(); saveState(true); emit('balanceChanged', getBalance()); emit('stateChanged'); }
    };

    /* ============================================================
       EVENTS GLUE
    ============================================================ */
    window.addEventListener('rewards:balanceChanged', (e) => {
        if (e.detail) onBalanceChanged(e.detail);
    });

    // Auto burst on large external coin additions
    window.addEventListener('rewards:currencyAdded', (e) => {
        const d = e.detail;
        if (!d) return;
        if (d.amount >= 400) showCoinBurst();
    });

    /* ============================================================
       INIT
    ============================================================ */
    function init() {
        state = loadState();
        verifyChecksum();
        ensureAchievements();
        ensureMissions();
        checkDailyStreakReset();
        resetMissionsIfNeeded();
        saveState(true);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupDOM);
        } else {
            setupDOM();
        }

        // Sync initial balance with UI after module script sets up listeners
        setTimeout(() => emit('balanceChanged', getBalance()), 200);
        setTimeout(() => emit('stateChanged'), 400);

        console.log('[Rewards] v1.0.0 ready — coins:', state.coins);
    }

    init();
})();
