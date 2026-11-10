/* ============================================================
   rewards.js — Monster Chess 3D
   الإصدار الاحترافي الموحّد v4.0 🪙
   ------------------------------------------------------------
   ملف واحد يجمع نظامين منفصلين منطقياً:
     ①  RewardsConfig  →  نظام تحديد قيم المكافآت (بيانات + تحقق)
     ②  RewardsSystem  →  نظام تنفيذ المكافآت (منطق + حفظ + أحداث)

   ✓ الحفاظ الكامل على الواجهة العامة والأحداث الأصلية
   ✓ فصل تام بين القيم والتنفيذ (تعديل القيم دون لمس المنطق)
   ✓ سجل معاملات + idempotency + تحقق صارم من القيم
   ✓ ترحيل تلقائي للبيانات القديمة دون فقدانها
   ✓ إشعارات toast اختيارية لا تتعارض مع index.html
   ✓ دعم Supabase مستقبلاً
   ✓ إعادة قراءة القيم فوراً عند تعديل الإعدادات
   ============================================================ */
(function () {
    'use strict';

    const VERSION = '4.0.0';
    const LOG_PREFIX = '[Rewards]';

    function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

    function deepFreeze(o) {
        if (!o || typeof o !== 'object') return o;
        Object.keys(o).forEach(k => deepFreeze(o[k]));
        return Object.freeze(o);
    }

    function emitEvent(fullName, detail) {
        try { window.dispatchEvent(new CustomEvent(fullName, { detail })); } catch (e) {}
    }

    /* ============================================================
       ████████████████████████████████████████████████████████████
       ①  نظام تحديد قيم المكافآت  —  RewardsConfig
       ████████████████████████████████████████████████████████████
       كل ما يخص "كم قيمة المكافأة؟" يعيش هنا.
       لا منطق لعبة — قراءة/تعديل/تحقق فقط.
       ============================================================ */

    const CONFIG_VERSION = 1;

    const DEFAULT_CONFIG = Object.freeze({

        version: CONFIG_VERSION,

        /* رصيد اللاعب الجديد */
        defaultBalance: {
            coins: 500,
            gems: 10,
            level: 1,
            xp: 0
        },

        /* المكافآت اليومية — 7 أيام بالضبط */
        dailyRewards: [
            { day: 1, type: 'coins', amount: 100,  icon: '🪙' },
            { day: 2, type: 'coins', amount: 250,  icon: '🪙' },
            { day: 3, type: 'gems',  amount: 5,    icon: '💎' },
            { day: 4, type: 'coins', amount: 500,  icon: '🪙' },
            { day: 5, type: 'gems',  amount: 10,   icon: '💎' },
            { day: 6, type: 'coins', amount: 1000, icon: '🪙' },
            { day: 7, type: 'gems',  amount: 25,   icon: '💎' }
        ],

        /* الإنجازات */
        achievements: [
            { key: 'win1',       name: '🏅 أول فوز',         target: 1,   reward: 100,  type: 'wins' },
            { key: 'win5',       name: '⚔️ محارب صاعد',      target: 5,   reward: 500,  type: 'wins' },
            { key: 'win20',      name: '🔥 بطل الميدان',     target: 20,  reward: 2000, type: 'wins' },
            { key: 'win50',      name: '👑 أسطورة الشطرنج',  target: 50,  reward: 5000, type: 'wins' },
            { key: 'capture10',  name: '💀 سفاح البيادق',    target: 10,  reward: 150,  type: 'captures' },
            { key: 'capture50',  name: '☠️ مدمر الجيوش',     target: 50,  reward: 800,  type: 'captures' },
            { key: 'capture100', name: '🩸 سفاح محترف',      target: 100, reward: 1500, type: 'captures' },
            { key: 'play10',     name: '♟️ لاعب مخلص',       target: 10,  reward: 200,  type: 'gamesPlayed' },
            { key: 'play50',     name: '🏛️ أسطورة الزمن',    target: 50,  reward: 1500, type: 'gamesPlayed' },
            { key: 'play100',    name: '🌌 خالد',            target: 100, reward: 4000, type: 'gamesPlayed' }
        ],

        /* المهام اليومية */
        missions: [
            { key: 'play1',    name: '🎯 العب مباراة واحدة', target: 1, reward: 50,  type: 'gamesPlayed' },
            { key: 'win1',     name: '🏆 اربح مباراة',        target: 1, reward: 150, type: 'wins' },
            { key: 'capture3', name: '⚔️ أسقط 3 قطع',         target: 3, reward: 100, type: 'captures' },
            { key: 'capture5', name: '🩸 أسقط 5 قطع',         target: 5, reward: 200, type: 'captures' }
        ],

        /* الصناديق */
        chests: {
            star: {
                cost: { coins: 1000 },
                cooldownMs: 2 * 60 * 60 * 1000,
                rewards: [
                    { type: 'coins', min: 500, max: 2000, weight: 50 },
                    { type: 'gems',  min: 5,   max: 25,   weight: 35 },
                    { type: 'xp',    min: 50,  max: 200,  weight: 15 }
                ]
            }
        },

        /* اقتصاد اللعبة */
        economy: {
            coinsPerXp: 5,
            xpOnWin: 50,
            xpOnLoss: 10,
            xpOnDraw: 20,
            gemsOnLevelUp: 10,
            xpFormulaBase: 100,
            xpFormulaExponent: 1.5
        },

        /* حدود النظام */
        limits: {
            txLimit: 100,
            idempotencyTtl: 5 * 60 * 1000,
            idempotencyLimit: 200
        }
    });

    const VALID_REWARD_TYPES = ['coins', 'gems', 'xp'];
    const isValidAmount = n => typeof n === 'number' && isFinite(n) && n > 0;

    let _config = deepClone(DEFAULT_CONFIG);

    /* ---------- التحقق من صحة الإعدادات ---------- */
    function validateConfig(cfg) {
        const errors = [];
        if (!cfg || typeof cfg !== 'object') return { ok: false, errors: ['config is not an object'] };

        // defaultBalance
        if (!cfg.defaultBalance || typeof cfg.defaultBalance !== 'object') {
            errors.push('defaultBalance missing');
        } else {
            ['coins', 'gems', 'level', 'xp'].forEach(k => {
                const v = cfg.defaultBalance[k];
                if (typeof v !== 'number' || !isFinite(v) || v < 0) errors.push(`defaultBalance.${k} invalid`);
            });
        }

        // dailyRewards
        if (!Array.isArray(cfg.dailyRewards)) {
            errors.push('dailyRewards must be array');
        } else if (cfg.dailyRewards.length !== 7) {
            errors.push('dailyRewards must have exactly 7 entries');
        } else {
            cfg.dailyRewards.forEach((r, i) => {
                if (!r || typeof r !== 'object') return errors.push(`dailyRewards[${i}] invalid`);
                if (!VALID_REWARD_TYPES.includes(r.type)) errors.push(`dailyRewards[${i}].type invalid`);
                if (!isValidAmount(r.amount)) errors.push(`dailyRewards[${i}].amount invalid`);
                if (r.day !== i + 1) errors.push(`dailyRewards[${i}].day should be ${i + 1}`);
            });
        }

        // achievements
        if (!Array.isArray(cfg.achievements)) {
            errors.push('achievements must be array');
        } else {
            const seen = new Set();
            cfg.achievements.forEach((a, i) => {
                if (!a || typeof a !== 'object') return errors.push(`achievements[${i}] invalid`);
                if (!a.key || typeof a.key !== 'string') errors.push(`achievements[${i}].key invalid`);
                else if (seen.has(a.key)) errors.push(`achievements[${i}].key duplicate: ${a.key}`);
                else seen.add(a.key);
                if (!isValidAmount(a.target)) errors.push(`achievements[${i}].target invalid`);
                if (!isValidAmount(a.reward)) errors.push(`achievements[${i}].reward invalid`);
            });
        }

        // missions
        if (!Array.isArray(cfg.missions)) {
            errors.push('missions must be array');
        } else {
            const seen = new Set();
            cfg.missions.forEach((m, i) => {
                if (!m || typeof m !== 'object') return errors.push(`missions[${i}] invalid`);
                if (!m.key || typeof m.key !== 'string') errors.push(`missions[${i}].key invalid`);
                else if (seen.has(m.key)) errors.push(`missions[${i}].key duplicate: ${m.key}`);
                else seen.add(m.key);
                if (!isValidAmount(m.target)) errors.push(`missions[${i}].target invalid`);
                if (!isValidAmount(m.reward)) errors.push(`missions[${i}].reward invalid`);
            });
        }

        // chests
        if (!cfg.chests || typeof cfg.chests !== 'object') {
            errors.push('chests invalid');
        } else {
            Object.keys(cfg.chests).forEach(key => {
                const c = cfg.chests[key];
                if (!c || typeof c !== 'object') return errors.push(`chests.${key} invalid`);
                if (!c.cost || typeof c.cost !== 'object') errors.push(`chests.${key}.cost invalid`);
                if (typeof c.cooldownMs !== 'number' || c.cooldownMs < 0) errors.push(`chests.${key}.cooldownMs invalid`);
                if (!Array.isArray(c.rewards) || !c.rewards.length) errors.push(`chests.${key}.rewards invalid`);
                else c.rewards.forEach((r, i) => {
                    if (!VALID_REWARD_TYPES.includes(r.type)) errors.push(`chests.${key}.rewards[${i}].type invalid`);
                    if (!isValidAmount(r.min) || !isValidAmount(r.max) || r.min > r.max) errors.push(`chests.${key}.rewards[${i}] min/max invalid`);
                    if (typeof r.weight !== 'number' || r.weight <= 0) errors.push(`chests.${key}.rewards[${i}].weight invalid`);
                });
            });
        }

        // economy
        if (!cfg.economy || typeof cfg.economy !== 'object') {
            errors.push('economy invalid');
        } else {
            ['coinsPerXp', 'xpFormulaBase'].forEach(k => {
                if (typeof cfg.economy[k] !== 'number' || cfg.economy[k] <= 0) errors.push(`economy.${k} invalid`);
            });
        }

        // limits
        if (!cfg.limits || typeof cfg.limits !== 'object') errors.push('limits invalid');

        return { ok: errors.length === 0, errors };
    }

    /* ---------- تطبيق آمن (rollback عند الفشل) ---------- */
    function _applyConfigChange(description, mutator) {
        try {
            const backup = deepClone(_config);
            mutator(_config);
            const v = validateConfig(_config);
            if (!v.ok) {
                _config = backup;
                console.warn(LOG_PREFIX, 'تغيير مرفوض:', description, v.errors);
                return { ok: false, errors: v.errors };
            }
            emitEvent('rewardsConfig:changed', { description, config: deepClone(_config) });
            return { ok: true };
        } catch (e) {
            console.error(LOG_PREFIX, 'خطأ في التطبيق:', description, e);
            return { ok: false, errors: [String((e && e.message) || e)] };
        }
    }

    function _patchObject(target, patch) {
        if (!patch || typeof patch !== 'object') return;
        Object.keys(patch).forEach(k => {
            const pv = patch[k], tv = target[k];
            if (pv && typeof pv === 'object' && !Array.isArray(pv) &&
                tv && typeof tv === 'object' && !Array.isArray(tv)) {
                _patchObject(tv, pv);
            } else {
                target[k] = pv;
            }
        });
    }

    /* ---------- واجهة RewardsConfig العامة ---------- */
    const RewardsConfig = {

        VERSION: '1.0.0',
        CONFIG_VERSION,
        DEFAULT_CONFIG: deepFreeze(deepClone(DEFAULT_CONFIG)),

        /* --- قراءة --- */
        getDailyRewards()   { return deepClone(_config.dailyRewards); },
        getAchievements()   { return deepClone(_config.achievements); },
        getMissions()       { return deepClone(_config.missions); },
        getChests()         { return deepClone(_config.chests); },
        getDefaultBalance() { return deepClone(_config.defaultBalance); },
        getEconomy()        { return deepClone(_config.economy); },
        getLimits()         { return deepClone(_config.limits); },
        getFullConfig()     { return deepClone(_config); },

        findAchievement(key) {
            const a = (_config.achievements || []).find(x => x.key === key);
            return a ? deepClone(a) : null;
        },
        findMission(key) {
            const m = (_config.missions || []).find(x => x.key === key);
            return m ? deepClone(m) : null;
        },
        findChest(key) {
            const c = (_config.chests || {})[key];
            return c ? deepClone(c) : null;
        },
        findDailyReward(dayNumber) {
            const r = (_config.dailyRewards || [])[Number(dayNumber) - 1];
            return r ? deepClone(r) : null;
        },

        /* --- تعديل جراحي --- */
        overrideBalance(patch) {
            return _applyConfigChange('balance', c => _patchObject(c.defaultBalance, patch));
        },
        overrideEconomy(patch) {
            return _applyConfigChange('economy', c => _patchObject(c.economy, patch));
        },
        overrideLimits(patch) {
            return _applyConfigChange('limits', c => _patchObject(c.limits, patch));
        },
        overrideAchievement(key, patch) {
            return _applyConfigChange('achievement:' + key, c => {
                const a = (c.achievements || []).find(x => x.key === key);
                if (!a) throw new Error('achievement not found: ' + key);
                _patchObject(a, patch);
            });
        },
        overrideMission(key, patch) {
            return _applyConfigChange('mission:' + key, c => {
                const m = (c.missions || []).find(x => x.key === key);
                if (!m) throw new Error('mission not found: ' + key);
                _patchObject(m, patch);
            });
        },
        overrideChest(key, patch) {
            return _applyConfigChange('chest:' + key, c => {
                if (!c.chests[key]) throw new Error('chest not found: ' + key);
                _patchObject(c.chests[key], patch);
            });
        },
        overrideDailyReward(dayNumber, patch) {
            return _applyConfigChange('daily:' + dayNumber, c => {
                const i = Number(dayNumber) - 1;
                if (i < 0 || i >= c.dailyRewards.length) throw new Error('daily reward not found: ' + dayNumber);
                _patchObject(c.dailyRewards[i], patch);
            });
        },

        /* --- إضافة --- */
        addAchievement(def) {
            return _applyConfigChange('add:achievement', c => {
                if (!def || !def.key) throw new Error('achievement def invalid');
                if (c.achievements.find(x => x.key === def.key)) throw new Error('achievement key exists');
                c.achievements.push(deepClone(def));
            });
        },
        addMission(def) {
            return _applyConfigChange('add:mission', c => {
                if (!def || !def.key) throw new Error('mission def invalid');
                if (c.missions.find(x => x.key === def.key)) throw new Error('mission key exists');
                c.missions.push(deepClone(def));
            });
        },
        addChest(key, def) {
            return _applyConfigChange('add:chest:' + key, c => {
                if (!key) throw new Error('chest key invalid');
                if (c.chests[key]) throw new Error('chest key exists');
                c.chests[key] = deepClone(def);
            });
        },

        /* --- استبدال كامل --- */
        replaceAll(newConfig) {
            return _applyConfigChange('replaceAll', c => {
                const merged = deepClone(DEFAULT_CONFIG);
                _patchObject(merged, newConfig);
                const v = validateConfig(merged);
                if (!v.ok) throw new Error('invalid config: ' + v.errors.join('; '));
                Object.keys(c).forEach(k => delete c[k]);
                Object.keys(merged).forEach(k => { c[k] = merged[k]; });
            });
        },

        /* --- تحقق --- */
        validate(cfg) { return validateConfig(cfg || _config); },

        /* --- تصدير / استيراد --- */
        export() { return JSON.stringify(_config); },
        import(json, options = {}) {
            try {
                const parsed = typeof json === 'string' ? JSON.parse(json) : json;
                if (options.merge === true) {
                    return _applyConfigChange('import:merge', c => _patchObject(c, parsed));
                }
                return this.replaceAll(parsed);
            } catch (e) {
                return { ok: false, errors: [String((e && e.message) || e)] };
            }
        },

        /* --- إعادة ضبط --- */
        reset() {
            _config = deepClone(DEFAULT_CONFIG);
            emitEvent('rewardsConfig:reset', { config: deepClone(_config) });
            return { ok: true };
        },

        isDefault() {
            try { return JSON.stringify(_config) === JSON.stringify(DEFAULT_CONFIG); }
            catch (e) { return false; }
        }
    };

    window.RewardsConfig = RewardsConfig;

    /* ============================================================
       ████████████████████████████████████████████████████████████
       ②  نظام تنفيذ المكافآت  —  RewardsSystem
       ████████████████████████████████████████████████████████████
       يقرأ كل القيم من RewardsConfig (نفس الملف)، ويعيد القراءة
       فوراً عند أي تعديل على الإعدادات.
       ============================================================ */

    /* ---------- ذاكرة القيم المؤقتة ---------- */
    let _CFG = null;

    function _refreshCfg() {
        try {
            const full = RewardsConfig.getFullConfig();
            _CFG = {
                dailyRewards:   Array.isArray(full.dailyRewards) && full.dailyRewards.length === 7
                                ? full.dailyRewards : deepClone(DEFAULT_CONFIG.dailyRewards),
                achievements:   Array.isArray(full.achievements) && full.achievements.length
                                ? full.achievements : deepClone(DEFAULT_CONFIG.achievements),
                missions:       Array.isArray(full.missions)
                                ? full.missions : deepClone(DEFAULT_CONFIG.missions),
                chests:         (full.chests && typeof full.chests === 'object')
                                ? full.chests : deepClone(DEFAULT_CONFIG.chests),
                defaultBalance: (full.defaultBalance && typeof full.defaultBalance === 'object')
                                ? full.defaultBalance : deepClone(DEFAULT_CONFIG.defaultBalance),
                economy:        (full.economy && typeof full.economy === 'object')
                                ? full.economy : deepClone(DEFAULT_CONFIG.economy),
                limits:         (full.limits && typeof full.limits === 'object')
                                ? full.limits : deepClone(DEFAULT_CONFIG.limits)
            };
        } catch (e) {
            console.warn(LOG_PREFIX, 'فشل قراءة RewardsConfig:', e);
            _CFG = deepClone(DEFAULT_CONFIG);
        }
    }
    _refreshCfg();

    // الاستماع لأي تغيير في الإعدادات
    try {
        ['changed', 'reset'].forEach(ev => {
            window.addEventListener('rewardsConfig:' + ev, _refreshCfg);
        });
    } catch (e) {}

    function _eco(key, fallback) {
        const v = _CFG.economy && _CFG.economy[key];
        return (typeof v === 'number' && isFinite(v) && v > 0) ? v : fallback;
    }
    function _lim(key, fallback) {
        const v = _CFG.limits && _CFG.limits[key];
        return (typeof v === 'number' && isFinite(v) && v > 0) ? v : fallback;
    }

    /* ---------- SafeStorage ---------- */
    const SafeStorage = (function () {
        let mem = {};
        let backend = null;

        function testBackend(name) {
            try {
                const s = window[name];
                if (!s) return false;
                const k = '__mc_test__';
                s.setItem(k, '1');
                s.removeItem(k);
                return true;
            } catch (e) { return false; }
        }
        if (testBackend('localStorage')) backend = window.localStorage;
        else if (testBackend('sessionStorage')) backend = window.sessionStorage;

        return {
            available: !!backend,
            getItem(k) { try { return backend ? backend.getItem(k) : (mem[k] || null); } catch (e) { return mem[k] || null; } },
            setItem(k, v) { try { if (backend) backend.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } },
            removeItem(k) { try { if (backend) backend.removeItem(k); } catch (e) {} delete mem[k]; }
        };
    })();

    const Storage = window.SafeStorage || SafeStorage;

    /* ---------- المفاتيح ---------- */
    const STORAGE_KEY = 'monsterChessRewards_v2_Coins';
    const LEGACY_KEYS = ['monsterChessRewards_v3_Coins', 'monsterChessRewards_v1_Coins'];
    const STATE_SCHEMA = 3;

    /* ---------- بناء الحالة الافتراضية من الإعدادات ---------- */
    function buildDefaultState() {
        return {
            schema: STATE_SCHEMA,
            balance: deepClone(_CFG.defaultBalance),
            daily: { lastClaimDate: null, streak: 0, claimedDays: [] },
            achievements: {},
            missions: {},
            chests: {},
            totals: { wins: 0, losses: 0, gamesPlayed: 0, captures: 0 },
            transactions: []
        };
    }

    /* ---------- أدوات مساعدة ---------- */
    const todayKey = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const daysBetween = (a, b) => {
        if (!a || !b) return Infinity;
        const d1 = new Date(a + 'T00:00:00');
        const d2 = new Date(b + 'T00:00:00');
        return Math.round((d2 - d1) / 86400000);
    };
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    function sanitizeAmount(n, allowZero = false) {
        n = Number(n);
        if (!Number.isFinite(n)) return 0;
        n = Math.floor(n);
        if (n < 0) return 0;
        if (!allowZero && n === 0) return 0;
        return n;
    }
    function sanitizeProgress(n) {
        n = Number(n);
        if (!Number.isFinite(n)) return 0;
        return Math.floor(n);
    }
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

    function validateState(s) {
        if (!s || typeof s !== 'object') return buildDefaultState();

        if (!s.balance || typeof s.balance !== 'object') s.balance = deepClone(_CFG.defaultBalance);
        s.balance.coins = Math.max(0, sanitizeAmount(s.balance.coins, true));
        s.balance.gems  = Math.max(0, sanitizeAmount(s.balance.gems, true));
        s.balance.level = Math.max(1, sanitizeAmount(s.balance.level, true) || 1);
        s.balance.xp    = Math.max(0, sanitizeAmount(s.balance.xp, true));

        if (!s.daily || typeof s.daily !== 'object') s.daily = { lastClaimDate: null, streak: 0, claimedDays: [] };
        if (!Array.isArray(s.daily.claimedDays)) s.daily.claimedDays = [];
        s.daily.streak = Math.max(0, sanitizeAmount(s.daily.streak, true));

        if (!s.totals || typeof s.totals !== 'object') s.totals = { wins: 0, losses: 0, gamesPlayed: 0, captures: 0 };
        ['wins', 'losses', 'gamesPlayed', 'captures'].forEach(k => {
            s.totals[k] = Math.max(0, sanitizeAmount(s.totals[k], true));
        });

        if (!Array.isArray(s.transactions)) s.transactions = [];
        const txLimit = _lim('txLimit', 100);
        if (s.transactions.length > txLimit) s.transactions = s.transactions.slice(-txLimit);

        if (!s.achievements || typeof s.achievements !== 'object') s.achievements = {};
        if (!s.missions     || typeof s.missions     !== 'object') s.missions = {};
        if (!s.chests       || typeof s.chests       !== 'object') s.chests = {};

        s.schema = STATE_SCHEMA;
        return s;
    }

    /* ---------- تحميل / حفظ ---------- */
    let state = loadState();

    function loadState() {
        try {
            let raw = Storage.getItem(STORAGE_KEY);
            if (!raw) {
                for (const lk of LEGACY_KEYS) {
                    const legacy = Storage.getItem(lk);
                    if (legacy) {
                        raw = legacy;
                        try { Storage.setItem(STORAGE_KEY, legacy); } catch (e) {}
                        break;
                    }
                }
            }
            if (!raw) return buildDefaultState();
            const parsed = JSON.parse(raw);
            return validateState(mergeDeep(buildDefaultState(), parsed));
        } catch (e) {
            console.warn(LOG_PREFIX, 'فشل تحميل الحالة، سيتم استخدام الحالة الافتراضية.', e);
            return buildDefaultState();
        }
    }

    function saveState() {
        try { Storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
        catch (e) { console.error(LOG_PREFIX, 'فشل حفظ الحالة:', e); }

        if (_cloudSync.enabled && _cloudSync.client) _scheduleCloudPush();
    }

    /* ---------- سجل المعاملات ---------- */
    function pushTx(entry) {
        try {
            if (!Array.isArray(state.transactions)) state.transactions = [];
            state.transactions.push(Object.assign({ ts: Date.now() }, entry));
            const txLimit = _lim('txLimit', 100);
            if (state.transactions.length > txLimit) {
                state.transactions = state.transactions.slice(-txLimit);
            }
        } catch (e) {}
    }

    /* ---------- الأحداث (مع تجميع) ---------- */
    function emit(name, detail) {
        emitEvent('rewards:' + name, detail);
    }

    let _batchDepth = 0;
    let _balanceChangedPending = false;
    let _stateChangedPending = false;

    function _batch(fn) {
        _batchDepth++;
        try { return fn(); }
        finally {
            _batchDepth--;
            if (_batchDepth === 0) {
                if (_balanceChangedPending) {
                    _balanceChangedPending = false;
                    emit('balanceChanged', { ...state.balance });
                }
                if (_stateChangedPending) {
                    _stateChangedPending = false;
                    emit('stateChanged', { state: deepClone(state) });
                }
            }
        }
    }
    function emitBalanceChanged() {
        if (_batchDepth > 0) { _balanceChangedPending = true; return; }
        emit('balanceChanged', { ...state.balance });
    }
    function emitStateChanged() {
        if (_batchDepth > 0) { _stateChangedPending = true; return; }
        emit('stateChanged', { state: deepClone(state) });
    }

    /* ---------- الإشعارات ---------- */
    let _hasExternalToast = null;
    function hasExternalToast() {
        if (_hasExternalToast !== null) return _hasExternalToast;
        try {
            _hasExternalToast =
                typeof window.showToast === 'function' ||
                (window.Toast && typeof window.Toast.show === 'function') ||
                (window.Notifications && typeof window.Notifications.show === 'function');
        } catch (e) { _hasExternalToast = false; }
        return _hasExternalToast;
    }

    const _notifyDedupe = new Map();
    function _notifyAllowed(key) {
        const now = Date.now();
        const last = _notifyDedupe.get(key) || 0;
        if (now - last < 500) return false;
        _notifyDedupe.set(key, now);
        if (_notifyDedupe.size > 60) {
            for (const [k, t] of _notifyDedupe) if (now - t > 5000) _notifyDedupe.delete(k);
        }
        return true;
    }

    function _builtinToast(message, type) {
        try {
            if (typeof document === 'undefined' || !document.body || !document.head) return;
            if (!document.getElementById('mc-rewards-toast-style')) {
                const style = document.createElement('style');
                style.id = 'mc-rewards-toast-style';
                style.textContent =
                    '.mc-rewards-toast-container{position:fixed;top:20px;right:20px;z-index:999999;' +
                    'display:flex;flex-direction:column;gap:8px;pointer-events:none;}' +
                    '.mc-rewards-toast{background:rgba(20,20,30,.95);color:#fff;padding:10px 16px;' +
                    'border-radius:10px;font-size:14px;border:1px solid rgba(255,215,0,.6);' +
                    'box-shadow:0 4px 20px rgba(0,0,0,.4);min-width:180px;' +
                    'animation:mcToastIn .3s ease-out,mcToastOut .3s ease-in 1.7s forwards;' +
                    'backdrop-filter:blur(6px);font-family:inherit;}' +
                    '.mc-rewards-toast.gems{border-color:#6cf;}' +
                    '.mc-rewards-toast.error{border-color:#f66;}' +
                    '.mc-rewards-toast.success{border-color:#6f6;}' +
                    '@keyframes mcToastIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}' +
                    '@keyframes mcToastOut{to{transform:translateX(120%);opacity:0}}';
                document.head.appendChild(style);
            }
            let container = document.querySelector('.mc-rewards-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'mc-rewards-toast-container';
                document.body.appendChild(container);
            }
            const t = document.createElement('div');
            t.className = 'mc-rewards-toast ' + (type || '');
            t.textContent = message;
            container.appendChild(t);
            setTimeout(() => { try { t.remove(); } catch (e) {} }, 2100);
        } catch (e) {}
    }

    function maybeToast(message, type = 'info') {
        try {
            if (window.__mcDisableBuiltinToast === true) return;
            if (!message) return;
            if (!_notifyAllowed(type + '|' + message)) return;
            emit('notify', { message, type });
            if (hasExternalToast()) return;
            _builtinToast(message, type);
        } catch (e) {}
    }

    /* ---------- Idempotency ---------- */
    const _idempotencyMap = new Map();
    function _checkIdempotency(key) {
        if (!key) return true;
        const ttl = _lim('idempotencyTtl', 300000);
        const limit = _lim('idempotencyLimit', 200);
        const now = Date.now();
        if (_idempotencyMap.size > limit) {
            for (const [k, t] of _idempotencyMap) if (now - t > ttl) _idempotencyMap.delete(k);
        }
        if (_idempotencyMap.has(key)) {
            const ts = _idempotencyMap.get(key);
            if (now - ts < ttl) return false;
        }
        _idempotencyMap.set(key, now);
        return true;
    }

    /* ---------- المستويات ---------- */
    function xpForLevel(level) {
        const lv = Math.max(1, Math.floor(Number(level) || 1));
        return Math.floor(_eco('xpFormulaBase', 100) * Math.pow(lv, _eco('xpFormulaExponent', 1.5)));
    }

    function addXp(amount) {
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount <= 0) return;
        amount = Math.floor(amount);

        state.balance.xp += amount;
        let leveled = false;
        const gemsBonus = Math.floor(_eco('gemsOnLevelUp', 10));

        while (state.balance.xp >= xpForLevel(state.balance.level)) {
            state.balance.xp -= xpForLevel(state.balance.level);
            state.balance.level += 1;
            leveled = true;
            state.balance.gems += gemsBonus;
            pushTx({
                type: 'levelUp', currency: 'gems', amount: gemsBonus,
                reason: `ترقية إلى المستوى ${state.balance.level}`,
                balance: state.balance.gems
            });
            emit('levelUp', { level: state.balance.level });
        }

        if (leveled) {
            emitBalanceChanged();
            maybeToast(`⭐ وصلت للمستوى ${state.balance.level}! +${gemsBonus} 💎`, 'success');
        }
    }

    /* ---------- Supabase hook ---------- */
    const _cloudSync = { enabled: false, client: null, pushTimer: null };

    function _scheduleCloudPush() {
        if (_cloudSync.pushTimer) return;
        _cloudSync.pushTimer = setTimeout(() => {
            _cloudSync.pushTimer = null;
            try {
                if (!_cloudSync.enabled || !_cloudSync.client) return;
                const payload = {
                    balance: state.balance,
                    totals: state.totals,
                    updated_at: new Date().toISOString()
                };
                if (typeof _cloudSync.client.from === 'function') {
                    _cloudSync.client.from('player_rewards').upsert(payload).catch(() => {});
                }
            } catch (e) {}
        }, 1500);
    }

    /* ============================================================
       واجهة RewardsSystem العامة
       ============================================================ */
    const RewardsSystem = {

        VERSION,

        /* ---------- الرصيد والمستوى ---------- */
        getBalance() { return { ...state.balance }; },

        getLevelInfo() {
            try {
                const next = xpForLevel(state.balance.level);
                return {
                    level: state.balance.level,
                    xp: state.balance.xp,
                    nextLevelXp: next,
                    percent: next > 0 ? Math.min(100, Math.floor((state.balance.xp / next) * 100)) : 0
                };
            } catch (e) {
                return { level: 1, xp: 0, nextLevelXp: 100, percent: 0 };
            }
        },

        /* ---------- إضافة ---------- */
        addCoins(amount, reason = '', options = {}) {
            return _batch(() => {
                try {
                    if (options.idempotencyKey && !_checkIdempotency('coins:' + options.idempotencyKey)) {
                        emit('claimBlocked', { type: 'coins', reason, key: options.idempotencyKey });
                        return { ok: false, error: 'duplicate', duplicate: true };
                    }
                    const n = sanitizeAmount(amount);
                    if (n <= 0) return { ok: false, error: 'invalid' };

                    state.balance.coins += n;
                    pushTx({ type: 'gain', currency: 'coins', amount: n, reason: String(reason || ''), balance: state.balance.coins });
                    addXp(Math.floor(n / _eco('coinsPerXp', 5)));
                    saveState();
                    emitBalanceChanged();
                    emit('currencyAdded', { type: 'coins', amount: n, reason, balance: state.balance.coins });

                    if (!options.silent) maybeToast(`+${n} 🪙${reason ? ' — ' + reason : ''}`, 'coins');
                    return { ok: true };
                } catch (e) {
                    console.error(LOG_PREFIX, 'addCoins error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        addGems(amount, reason = '', options = {}) {
            return _batch(() => {
                try {
                    if (options.idempotencyKey && !_checkIdempotency('gems:' + options.idempotencyKey)) {
                        emit('claimBlocked', { type: 'gems', reason, key: options.idempotencyKey });
                        return { ok: false, error: 'duplicate', duplicate: true };
                    }
                    const n = sanitizeAmount(amount);
                    if (n <= 0) return { ok: false, error: 'invalid' };

                    state.balance.gems += n;
                    pushTx({ type: 'gain', currency: 'gems', amount: n, reason: String(reason || ''), balance: state.balance.gems });
                    saveState();
                    emitBalanceChanged();
                    emit('currencyAdded', { type: 'gems', amount: n, reason, balance: state.balance.gems });

                    if (!options.silent) maybeToast(`+${n} 💎${reason ? ' — ' + reason : ''}`, 'gems');
                    return { ok: true };
                } catch (e) {
                    console.error(LOG_PREFIX, 'addGems error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        addStars(amount, reason = '', options = {}) { return this.addCoins(amount, reason, options); },

        spendCoins(amount, reason = '') {
            return _batch(() => {
                try {
                    const n = sanitizeAmount(amount);
                    if (n <= 0) return { ok: false, error: 'invalid' };
                    if (state.balance.coins < n) return { ok: false, error: 'لا توجد عملات كافية' };

                    state.balance.coins -= n;
                    pushTx({ type: 'spend', currency: 'coins', amount: -n, reason: String(reason || 'spend'), balance: state.balance.coins });
                    saveState();
                    emitBalanceChanged();
                    emit('currencySpent', { type: 'coins', amount: n, reason, balance: state.balance.coins });
                    return { ok: true };
                } catch (e) {
                    console.error(LOG_PREFIX, 'spendCoins error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        spendGems(amount, reason = '') {
            return _batch(() => {
                try {
                    const n = sanitizeAmount(amount);
                    if (n <= 0) return { ok: false, error: 'invalid' };
                    if (state.balance.gems < n) return { ok: false, error: 'لا توجد أحجار كافية' };

                    state.balance.gems -= n;
                    pushTx({ type: 'spend', currency: 'gems', amount: -n, reason: String(reason || 'spend'), balance: state.balance.gems });
                    saveState();
                    emitBalanceChanged();
                    emit('currencySpent', { type: 'gems', amount: n, reason, balance: state.balance.gems });
                    return { ok: true };
                } catch (e) { return { ok: false, error: 'exception' }; }
            });
        },

        addXp(amount, reason = '') {
            return _batch(() => {
                try {
                    const n = sanitizeAmount(amount);
                    if (n <= 0) return { ok: false, error: 'invalid' };
                    addXp(n);
                    saveState();
                    emitBalanceChanged();
                    emitStateChanged();
                    return { ok: true };
                } catch (e) { return { ok: false, error: 'exception' }; }
            });
        },

        /* ---------- المكافآت اليومية ---------- */
        getDailyStatus() {
            try {
                const today = todayKey();
                const last = state.daily.lastClaimDate;
                const gap = last ? daysBetween(last, today) : Infinity;
                let streak = state.daily.streak || 0;
                let claimedDays = Array.isArray(state.daily.claimedDays) ? [...state.daily.claimedDays] : [];
                if (gap > 1 && last !== null) { streak = 0; claimedDays = []; }
                const currentIndex = streak % 7;
                const canClaim = (last !== today);
                const rewards = _CFG.dailyRewards.map((r, i) => {
                    const claimed = claimedDays.includes(i);
                    return { ...r, claimed, isCurrent: (i === currentIndex) && !claimed && canClaim };
                });
                return { rewards, streak, canClaim, currentDay: currentIndex + 1 };
            } catch (e) {
                console.error(LOG_PREFIX, 'getDailyStatus error:', e);
                return { rewards: [], streak: 0, canClaim: false, currentDay: 1 };
            }
        },

        claimDaily(index) {
            return _batch(() => {
                try {
                    const idx = Number(index);
                    if (!Number.isInteger(idx) || idx < 0 || idx > 6) return { ok: false, error: 'invalid index' };

                    const today = todayKey();
                    const last = state.daily.lastClaimDate;
                    const gap = last ? daysBetween(last, today) : Infinity;

                    if (gap > 1 && last !== null) {
                        state.daily.streak = 0;
                        state.daily.claimedDays = [];
                    }

                    const status = this.getDailyStatus();
                    if (!status.canClaim) return { ok: false, error: 'تم الاستلام مسبقاً' };
                    if (idx !== status.currentDay - 1) return { ok: false, error: 'غير متاح' };

                    const rw = _CFG.dailyRewards[idx];
                    if (!rw) return { ok: false, error: 'invalid reward' };

                    if (rw.type === 'coins') this.addCoins(rw.amount, 'مكافأة يومية', { silent: true });
                    else if (rw.type === 'gems') this.addGems(rw.amount, 'مكافأة يومية', { silent: true });

                    state.daily.streak = (gap === 1) ? (state.daily.streak || 0) + 1 : 1;
                    state.daily.lastClaimDate = today;

                    if (!Array.isArray(state.daily.claimedDays)) state.daily.claimedDays = [];
                    if (!state.daily.claimedDays.includes(idx)) state.daily.claimedDays.push(idx);

                    if (state.daily.streak > 7) {
                        state.daily.streak = 1;
                        state.daily.claimedDays = [idx];
                    }

                    saveState();
                    emitStateChanged();
                    emit('dailyClaimed', { day: idx + 1, reward: rw });
                    maybeToast(`🎁 مكافأة يوم ${idx + 1}: +${rw.amount} ${rw.icon}`, 'success');
                    return { ok: true, reward: rw };
                } catch (e) {
                    console.error(LOG_PREFIX, 'claimDaily error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        /* ---------- الإنجازات ---------- */
        getAchievements() {
            try {
                return _CFG.achievements.map(def => {
                    const s = state.achievements[def.key] || { progress: 0, claimed: false };
                    const progress = clamp(sanitizeProgress(s.progress), 0, def.target);
                    return {
                        ...def, progress,
                        completed: progress >= def.target,
                        claimed: !!s.claimed,
                        percent: Math.round((progress / def.target) * 100)
                    };
                });
            } catch (e) {
                return _CFG.achievements.map(def => ({ ...def, progress: 0, completed: false, claimed: false, percent: 0 }));
            }
        },

        updateAchievement(key, delta) {
            return _batch(() => {
                try {
                    const def = _CFG.achievements.find(a => a.key === key);
                    if (!def) return;
                    const d = sanitizeProgress(delta);
                    if (d === 0) return;

                    if (!state.achievements[key]) state.achievements[key] = { progress: 0, claimed: false };
                    const before = sanitizeProgress(state.achievements[key].progress);
                    state.achievements[key].progress = clamp(before + d, 0, def.target);
                    saveState();

                    if (before < def.target && state.achievements[key].progress >= def.target) {
                        emit('achievementCompleted', { key, def });
                        maybeToast(`🏆 إنجاز مكتمل: ${def.name}`, 'success');
                    }
                    emitStateChanged();
                } catch (e) { console.error(LOG_PREFIX, 'updateAchievement error:', e); }
            });
        },

        claimAchievement(key) {
            return _batch(() => {
                try {
                    const def = _CFG.achievements.find(a => a.key === key);
                    if (!def) return { ok: false, error: 'غير موجود' };
                    const s = state.achievements[key];
                    if (!s) return { ok: false, error: 'لم يكتمل' };
                    if (sanitizeProgress(s.progress) < def.target) return { ok: false, error: 'لم يكتمل' };
                    if (s.claimed) {
                        emit('claimBlocked', { type: 'achievement', key });
                        return { ok: false, error: 'تم الاستلام' };
                    }

                    s.claimed = true;
                    this.addCoins(def.reward, `إنجاز: ${def.name}`, {
                        silent: true, idempotencyKey: 'ach:' + key
                    });
                    saveState();
                    emitStateChanged();
                    emit('achievementClaimed', { key, def, reward: def.reward });
                    maybeToast(`🏆 ${def.name} +${def.reward} 🪙`, 'success');
                    return { ok: true, reward: def.reward };
                } catch (e) {
                    console.error(LOG_PREFIX, 'claimAchievement error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        /* ---------- المهام ---------- */
        _ensureMissionsReset() {
            try {
                const today = todayKey();
                if (!state.missions.__resetDate || state.missions.__resetDate !== today) {
                    state.missions.__resetDate = today;
                    _CFG.missions.forEach(def => { state.missions[def.key] = { progress: 0, claimed: false }; });
                    saveState();
                }
            } catch (e) {}
        },

        getMissions() {
            try {
                this._ensureMissionsReset();
                return _CFG.missions.map(def => {
                    const s = state.missions[def.key] || { progress: 0, claimed: false };
                    const progress = clamp(sanitizeProgress(s.progress), 0, def.target);
                    return {
                        ...def, progress,
                        completed: progress >= def.target,
                        claimed: !!s.claimed,
                        percent: Math.round((progress / def.target) * 100)
                    };
                });
            } catch (e) {
                return _CFG.missions.map(def => ({ ...def, progress: 0, completed: false, claimed: false, percent: 0 }));
            }
        },

        updateMission(key, delta) {
            return _batch(() => {
                try {
                    this._ensureMissionsReset();
                    const def = _CFG.missions.find(m => m.key === key);
                    if (!def) return;
                    const d = sanitizeProgress(delta);
                    if (d === 0) return;

                    if (!state.missions[key]) state.missions[key] = { progress: 0, claimed: false };
                    if (state.missions[key].claimed) return;
                    const before = sanitizeProgress(state.missions[key].progress);
                    state.missions[key].progress = clamp(before + d, 0, def.target);
                    saveState();

                    if (before < def.target && state.missions[key].progress >= def.target) {
                        emit('missionCompleted', { key, def });
                        maybeToast(`🎯 مهمة مكتملة: ${def.name}`, 'success');
                    }
                    emitStateChanged();
                } catch (e) { console.error(LOG_PREFIX, 'updateMission error:', e); }
            });
        },

        claimMission(key) {
            return _batch(() => {
                try {
                    this._ensureMissionsReset();
                    const def = _CFG.missions.find(m => m.key === key);
                    if (!def) return { ok: false, error: 'غير موجود' };
                    const s = state.missions[key];
                    if (!s || sanitizeProgress(s.progress) < def.target) return { ok: false, error: 'لم يكتمل' };
                    if (s.claimed) {
                        emit('claimBlocked', { type: 'mission', key });
                        return { ok: false, error: 'تم الاستلام' };
                    }

                    s.claimed = true;
                    this.addCoins(def.reward, `مهمة: ${def.name}`, {
                        silent: true,
                        idempotencyKey: 'mis:' + key + ':' + (state.missions.__resetDate || '')
                    });
                    saveState();
                    emitStateChanged();
                    emit('missionClaimed', { key, def, reward: def.reward });
                    maybeToast(`🎯 ${def.name} +${def.reward} 🪙`, 'success');
                    return { ok: true, reward: def.reward };
                } catch (e) {
                    console.error(LOG_PREFIX, 'claimMission error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        /* ---------- الصناديق ---------- */
        getChestStatus(key) {
            try {
                const def = _CFG.chests[key];
                if (!def) return null;
                const s = state.chests[key] || {};
                const last = Number(s.lastOpenTs) || 0;
                const remaining = Math.max(0, (last + def.cooldownMs) - Date.now());
                return { ready: remaining === 0, remainingMs: remaining, cost: { ...def.cost } };
            } catch (e) { return null; }
        },

        openChest(key) {
            return _batch(() => {
                try {
                    const def = _CFG.chests[key];
                    if (!def) return { ok: false, error: 'غير موجود' };
                    const st = this.getChestStatus(key);
                    if (!st) return { ok: false, error: 'invalid' };
                    if (!st.ready) return { ok: false, error: 'انتظر قليلاً' };

                    if (def.cost.coins && state.balance.coins < def.cost.coins) return { ok: false, error: 'تحتاج ' + def.cost.coins + ' 🪙' };
                    if (def.cost.gems && state.balance.gems < def.cost.gems) return { ok: false, error: 'تحتاج ' + def.cost.gems + ' 💎' };

                    const totalWeight = def.rewards.reduce((a, r) => a + r.weight, 0);
                    let roll = Math.random() * totalWeight;
                    let picked = def.rewards[0];
                    for (const r of def.rewards) {
                        if (roll < r.weight) { picked = r; break; }
                        roll -= r.weight;
                    }
                    const amount = randInt(picked.min, picked.max);

                    if (def.cost.coins) {
                        const sp = this.spendCoins(def.cost.coins, 'صندوق');
                        if (!sp.ok) return sp;
                    }
                    if (def.cost.gems) {
                        const sp = this.spendGems(def.cost.gems, 'صندوق');
                        if (!sp.ok) return sp;
                    }

                    if (picked.type === 'coins') this.addCoins(amount, 'صندوق', { silent: true });
                    else if (picked.type === 'gems') this.addGems(amount, 'صندوق', { silent: true });
                    else if (picked.type === 'xp') addXp(amount);

                    if (!state.chests[key]) state.chests[key] = {};
                    state.chests[key].lastOpenTs = Date.now();

                    saveState();
                    emitStateChanged();
                    emit('chestOpened', { key, reward: { type: picked.type, amount } });

                    const icon = picked.type === 'coins' ? '🪙' : (picked.type === 'gems' ? '💎' : '⭐');
                    maybeToast(`🎁 فتح الصندوق: +${amount} ${icon}`, 'success');
                    return { ok: true, reward: { type: picked.type, amount } };
                } catch (e) {
                    console.error(LOG_PREFIX, 'openChest error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        /* ---------- الإحصاءات ---------- */
        recordGame(result, options = {}) {
            return _batch(() => {
                try {
                    let outcome = result;
                    if (result && typeof result === 'object') outcome = result.result || result.outcome || 'unknown';

                    state.totals.gamesPlayed += 1;

                    if (outcome === 'win') {
                        state.totals.wins += 1;
                        _CFG.achievements.forEach(a => { if (a.type === 'wins') this.updateAchievement(a.key, 1); });
                        addXp(_eco('xpOnWin', 50));
                    } else if (outcome === 'loss') {
                        state.totals.losses += 1;
                        addXp(_eco('xpOnLoss', 10));
                    } else {
                        addXp(_eco('xpOnDraw', 20));
                    }

                    _CFG.achievements.forEach(a => { if (a.type === 'gamesPlayed') this.updateAchievement(a.key, 1); });

                    if (options.updateMissions === true) {
                        this.updateMission('play1', 1);
                        if (outcome === 'win') this.updateMission('win1', 1);
                    }

                    saveState();
                    emitStateChanged();
                    emit('gameRecorded', { outcome, totals: { ...state.totals } });
                } catch (e) { console.error(LOG_PREFIX, 'recordGame error:', e); }
            });
        },

        recordCapture(count = 1, options = {}) {
            return _batch(() => {
                try {
                    const n = sanitizeAmount(count, true);
                    if (n <= 0) return;
                    state.totals.captures += n;

                    _CFG.achievements.forEach(a => { if (a.type === 'captures') this.updateAchievement(a.key, n); });

                    if (options.updateMissions === true) {
                        this.updateMission('capture3', n);
                        this.updateMission('capture5', n);
                    }

                    saveState();
                    emitStateChanged();
                    emit('captureRecorded', { count: n, total: state.totals.captures });
                } catch (e) { console.error(LOG_PREFIX, 'recordCapture error:', e); }
            });
        },

        /* ---------- سجل / حالة / استيراد ---------- */
        getTransactionLog(limit = 20) {
            try {
                const log = Array.isArray(state.transactions) ? state.transactions : [];
                const txLimit = _lim('txLimit', 100);
                const n = Math.max(1, Math.min(Number(limit) || 20, txLimit));
                return log.slice(-n).map(t => ({ ...t }));
            } catch (e) { return []; }
        },

        getState() { try { return deepClone(state); } catch (e) { return null; } },
        exportState() { try { return JSON.stringify(state); } catch (e) { return null; } },

        importState(obj, options = {}) {
            return _batch(() => {
                try {
                    if (typeof obj === 'string') obj = JSON.parse(obj);
                    if (!obj || typeof obj !== 'object') return { ok: false, error: 'invalid' };
                    if (options.merge === true) mergeDeep(state, obj);
                    else state = validateState(mergeDeep(buildDefaultState(), obj));
                    saveState();
                    emitBalanceChanged();
                    emitStateChanged();
                    return { ok: true };
                } catch (e) {
                    console.error(LOG_PREFIX, 'importState error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        notify(message, type = 'info') { maybeToast(message, type); },

        /* ---------- مزامنة سحابية ---------- */
        enableCloudSync(client) {
            if (!client) return false;
            _cloudSync.client = client;
            _cloudSync.enabled = true;
            return true;
        },
        disableCloudSync() { _cloudSync.enabled = false; _cloudSync.client = null; },

        /* ---------- إعادة تعيين ---------- */
        resetAll() {
            return _batch(() => {
                try {
                    state = buildDefaultState();
                    _idempotencyMap.clear();
                    _notifyDedupe.clear();
                    saveState();
                    emitBalanceChanged();
                    emitStateChanged();
                    emit('reset', {});
                    maybeToast('♻️ تم إعادة تعيين النظام', 'info');
                    return { ok: true };
                } catch (e) { return { ok: false, error: 'exception' }; }
            });
        },

        /* ---------- إعادة تحميل الإعدادات يدوياً ---------- */
        reloadConfig() {
            _refreshCfg();
            return { ok: true, config: deepClone(_CFG) };
        }
    };

    window.RewardsSystem = RewardsSystem;

    /* ============================================================
       التهيئة النهائية
       ============================================================ */
    function _emitInitial() {
        emitBalanceChanged();
        emitStateChanged();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _emitInitial, { once: true });
    } else {
        setTimeout(_emitInitial, 0);
    }

    // تحقق من صحة القيم الافتراضية
    try {
        const v = validateConfig(_config);
        if (!v.ok) console.warn(LOG_PREFIX, 'القيم الافتراضية تحتوي مشاكل:', v.errors);
    } catch (e) {}

    console.log(`${LOG_PREFIX} 🪙 v${VERSION} — نظام موحّد جاهز (Config + System).`);
})();
