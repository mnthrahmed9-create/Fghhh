/* ============================================================
   rewards.js — Monster Chess 3D (الإصدار الاحترافي v3.0 - ذهب 🪙)
   ------------------------------------------------------------
   ✓ الحفاظ الكامل على الواجهة العامة (Public API) والأحداث
   ✓ سجل معاملات تفصيلي لكل ربح/خصم
   ✓ منع تكرار استلام المكافآت (Idempotency)
   ✓ تحقق صارم من صحة القيم (لا سالب، لا NaN، لا Infinity)
   ✓ ترحيل تلقائي للبيانات القديمة دون فقدانها
   ✓ إشعارات متحركة اختيارية (لا تتعارض مع index.html)
   ✓ دعم Supabase مستقبلاً (hook جاهز)
   ✓ معالجة استثناءات شاملة
   ✓ تجميع الأحداث لمنع التكرار وتحسين الأداء
   ✓ إصلاح خطأ تكرار claimedDays بعد انقطاع السلسلة اليومية
   ============================================================ */
(function () {
    'use strict';

    const VERSION = '3.0.0';
    const LOG_PREFIX = '[Rewards]';

    /* ============================================================
       1) SafeStorage — تخزين آمن مع احتياطي في الذاكرة
       ============================================================ */
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
            getItem(key) {
                try {
                    const v = backend ? backend.getItem(key) : (mem[key] || null);
                    return v;
                } catch (e) { return mem[key] || null; }
            },
            setItem(key, value) {
                try {
                    if (backend) backend.setItem(key, value);
                    else mem[key] = value;
                } catch (e) {
                    // قد يكون تجاوز السعة؛ احتفظ بالبيانات في الذاكرة
                    mem[key] = value;
                }
            },
            removeItem(key) {
                try { if (backend) backend.removeItem(key); } catch (e) {}
                delete mem[key];
            }
        };
    })();

    const Storage = window.SafeStorage || SafeStorage;

    /* ============================================================
       2) المفاتيح والإعدادات (متوافقة مع الإصدارات السابقة)
       ============================================================ */
    const STORAGE_KEY = 'monsterChessRewards_v2_Coins';
    // مفاتيح ترحيل اختيارية في حال وجود إصدارات وسيطة
    const LEGACY_KEYS = [
        'monsterChessRewards_v3_Coins',
        'monsterChessRewards_v1_Coins'
    ];

    const STATE_SCHEMA = 3;
    const TX_LIMIT = 100;
    const IDEMPOTENCY_TTL = 5 * 60 * 1000;
    const IDEMPOTENCY_LIMIT = 200;

    /* ============================================================
       3) إعدادات المكافآت (كما هي في الأصل تماماً)
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
    ];

    const MISSIONS_DEF = [
        { key: 'play1',    name: '🎯 العب مباراة واحدة', target: 1, reward: 50,  type: 'gamesPlayed' },
        { key: 'win1',     name: '🏆 اربح مباراة',        target: 1, reward: 150, type: 'wins' },
        { key: 'capture3', name: '⚔️ أسقط 3 قطع',         target: 3, reward: 100, type: 'captures' },
        { key: 'capture5', name: '🩸 أسقط 5 قطع',         target: 5, reward: 200, type: 'captures' }
    ];

    const CHESTS_DEF = {
        star: {
            cost: { coins: 1000 },
            cooldownMs: 2 * 60 * 60 * 1000,
            rewards: [
                { type: 'coins', min: 500, max: 2000, weight: 50 },
                { type: 'gems',  min: 5,   max: 25,   weight: 35 },
                { type: 'xp',    min: 50,  max: 200,  weight: 15 }
            ]
        }
    };

    /* ============================================================
       4) الحالة الافتراضية (مع سجل المعاملات)
       ============================================================ */
    const DEFAULT_STATE = {
        schema: STATE_SCHEMA,
        balance: { coins: 500, gems: 10, level: 1, xp: 0 },
        daily:   { lastClaimDate: null, streak: 0, claimedDays: [] },
        achievements: {},
        missions:     {},
        chests:       {},
        totals: { wins: 0, losses: 0, gamesPlayed: 0, captures: 0 },
        transactions: []
    };

    /* ============================================================
       5) أدوات مساعدة
       ============================================================ */
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

    function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

    // تحقق صارم من الأرقام (يمنع NaN/Salty/Infinity)
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

    // تطهير الحالة المسترجعة (يضمن سلامة الأنواع)
    function validateState(s) {
        if (!s || typeof s !== 'object') return deepClone(DEFAULT_STATE);

        if (!s.balance || typeof s.balance !== 'object') s.balance = deepClone(DEFAULT_STATE.balance);
        s.balance.coins = Math.max(0, sanitizeAmount(s.balance.coins, true));
        s.balance.gems  = Math.max(0, sanitizeAmount(s.balance.gems, true));
        s.balance.level = Math.max(1, sanitizeAmount(s.balance.level, true) || 1);
        s.balance.xp    = Math.max(0, sanitizeAmount(s.balance.xp, true));

        if (!s.daily || typeof s.daily !== 'object') s.daily = deepClone(DEFAULT_STATE.daily);
        if (!Array.isArray(s.daily.claimedDays)) s.daily.claimedDays = [];
        s.daily.streak = Math.max(0, sanitizeAmount(s.daily.streak, true));

        if (!s.totals || typeof s.totals !== 'object') s.totals = deepClone(DEFAULT_STATE.totals);
        ['wins', 'losses', 'gamesPlayed', 'captures'].forEach(k => {
            s.totals[k] = Math.max(0, sanitizeAmount(s.totals[k], true));
        });

        if (!Array.isArray(s.transactions)) s.transactions = [];
        if (s.transactions.length > TX_LIMIT) s.transactions = s.transactions.slice(-TX_LIMIT);

        if (!s.achievements || typeof s.achievements !== 'object') s.achievements = {};
        if (!s.missions     || typeof s.missions     !== 'object') s.missions = {};
        if (!s.chests       || typeof s.chests       !== 'object') s.chests = {};

        s.schema = STATE_SCHEMA;
        return s;
    }

    /* ============================================================
       6) تحميل / حفظ الحالة (مع ترحيل تلقائي)
       ============================================================ */
    let state = loadState();

    function loadState() {
        try {
            let raw = Storage.getItem(STORAGE_KEY);

            // ترحيل تلقائي من مفاتيح قديمة
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

            if (!raw) return deepClone(DEFAULT_STATE);
            const parsed = JSON.parse(raw);
            const merged = mergeDeep(deepClone(DEFAULT_STATE), parsed);
            return validateState(merged);
        } catch (e) {
            console.warn(LOG_PREFIX, 'فشل تحميل الحالة، سيتم استخدام الحالة الافتراضية.', e);
            return deepClone(DEFAULT_STATE);
        }
    }

    function saveState() {
        try {
            Storage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error(LOG_PREFIX, 'فشل حفظ الحالة:', e);
        }
        // نقطة تكامل مستقبلية مع Supabase
        if (_cloudSync.enabled && _cloudSync.client) {
            _scheduleCloudPush();
        }
    }

    /* ============================================================
       7) سجل المعاملات (Transactions Log)
       ============================================================ */
    function pushTx(entry) {
        try {
            if (!Array.isArray(state.transactions)) state.transactions = [];
            state.transactions.push(Object.assign({ ts: Date.now() }, entry));
            if (state.transactions.length > TX_LIMIT) {
                state.transactions = state.transactions.slice(-TX_LIMIT);
            }
        } catch (e) { /* تجاهل */ }
    }

    /* ============================================================
       8) نظام الأحداث (مع تجميع لتقليل الحمل)
       ============================================================ */
    function emit(name, detail) {
        try {
            window.dispatchEvent(new CustomEvent('rewards:' + name, { detail }));
        } catch (e) { /* تجاهل */ }
    }

    let _batchDepth = 0;
    let _balanceChangedPending = false;
    let _stateChangedPending = false;

    function _batch(fn) {
        _batchDepth++;
        try {
            return fn();
        } finally {
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

    /* ============================================================
       9) نظام الإشعارات (اختياري وآمن — لا يتعارض مع index.html)
       ============================================================ */
    let _hasExternalToast = null;
    function hasExternalToast() {
        if (_hasExternalToast !== null) return _hasExternalToast;
        try {
            _hasExternalToast =
                typeof window.showToast === 'function' ||
                (window.Toast && typeof window.Toast.show === 'function') ||
                (window.Notifications && typeof window.Notifications.show === 'function');
        } catch (e) {
            _hasExternalToast = false;
        }
        return _hasExternalToast;
    }

    const _notifyDedupe = new Map();
    function _notifyAllowed(key) {
        const now = Date.now();
        const last = _notifyDedupe.get(key) || 0;
        if (now - last < 500) return false;
        _notifyDedupe.set(key, now);
        // تنظيف
        if (_notifyDedupe.size > 60) {
            for (const [k, t] of _notifyDedupe) {
                if (now - t > 5000) _notifyDedupe.delete(k);
            }
        }
        return true;
    }

    function _builtinToast(message, type) {
        try {
            if (typeof document === 'undefined' || !document.body) return;
            if (!document.head) return;

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
        } catch (e) { /* تجاهل */ }
    }

    function maybeToast(message, type = 'info') {
        try {
            if (window.__mcDisableBuiltinToast === true) return;
            if (!message) return;
            if (!_notifyAllowed(type + '|' + message)) return;
            emit('notify', { message, type });
            if (hasExternalToast()) return; // اللعبة ستتولى الإشعار
            _builtinToast(message, type);
        } catch (e) { /* تجاهل */ }
    }

    /* ============================================================
       10) حماية من تكرار العمليات (Idempotency)
       ============================================================ */
    const _idempotencyMap = new Map();
    function _checkIdempotency(key) {
        if (!key) return true;
        const now = Date.now();
        if (_idempotencyMap.size > IDEMPOTENCY_LIMIT) {
            for (const [k, t] of _idempotencyMap) {
                if (now - t > IDEMPOTENCY_TTL) _idempotencyMap.delete(k);
            }
        }
        if (_idempotencyMap.has(key)) {
            const ts = _idempotencyMap.get(key);
            if (now - ts < IDEMPOTENCY_TTL) return false;
        }
        _idempotencyMap.set(key, now);
        return true;
    }

    /* ============================================================
       11) المستويات (Levels & XP)
       ============================================================ */
    function xpForLevel(level) {
        const lv = Math.max(1, Math.floor(Number(level) || 1));
        return Math.floor(100 * Math.pow(lv, 1.5));
    }

    function addXp(amount) {
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount <= 0) return;
        amount = Math.floor(amount);

        state.balance.xp += amount;
        let leveled = false;

        while (state.balance.xp >= xpForLevel(state.balance.level)) {
            state.balance.xp -= xpForLevel(state.balance.level);
            state.balance.level += 1;
            leveled = true;
            state.balance.gems += 10;
            pushTx({
                type: 'levelUp',
                currency: 'gems',
                amount: 10,
                reason: `ترقية إلى المستوى ${state.balance.level}`,
                balance: state.balance.gems
            });
            emit('levelUp', { level: state.balance.level });
        }

        if (leveled) {
            emitBalanceChanged();
            maybeToast(`⭐ وصلت للمستوى ${state.balance.level}! +10 💎`, 'success');
        }
    }

    /* ============================================================
       12) التكامل المستقبلي مع Supabase (hook جاهز)
       ============================================================ */
    const _cloudSync = {
        enabled: false,
        client: null,
        pushTimer: null
    };

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
                    // مثال توضيحي — المستخدم يجب أن يضبط الجدول والاستيثاق
                    _cloudSync.client.from('player_rewards').upsert(payload).catch(() => {});
                }
            } catch (e) { /* تجاهل */ }
        }, 1500);
    }

    /* ============================================================
       13) الواجهة العامة (Public API)
       ============================================================ */
    const RewardsSystem = {

        VERSION,

        /* ---------- الرصيد والمستوى ---------- */
        getBalance() {
            return { ...state.balance };
        },

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

        /* ---------- إضافة عملات ---------- */
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
                    pushTx({
                        type: 'gain', currency: 'coins', amount: n,
                        reason: String(reason || ''),
                        balance: state.balance.coins
                    });
                    addXp(Math.floor(n / 5));
                    saveState();
                    emitBalanceChanged();
                    emit('currencyAdded', { type: 'coins', amount: n, reason, balance: state.balance.coins });

                    if (!options.silent) {
                        maybeToast(`+${n} 🪙${reason ? ' — ' + reason : ''}`, 'coins');
                    }
                    return { ok: true };
                } catch (e) {
                    console.error(LOG_PREFIX, 'addCoins error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        /* ---------- إضافة أحجار ---------- */
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
                    pushTx({
                        type: 'gain', currency: 'gems', amount: n,
                        reason: String(reason || ''),
                        balance: state.balance.gems
                    });
                    saveState();
                    emitBalanceChanged();
                    emit('currencyAdded', { type: 'gems', amount: n, reason, balance: state.balance.gems });

                    if (!options.silent) {
                        maybeToast(`+${n} 💎${reason ? ' — ' + reason : ''}`, 'gems');
                    }
                    return { ok: true };
                } catch (e) {
                    console.error(LOG_PREFIX, 'addGems error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        /* ---------- توافق قديم ---------- */
        addStars(amount, reason = '', options = {}) {
            return this.addCoins(amount, reason, options);
        },

        /* ---------- خصم عملات ---------- */
        spendCoins(amount, reason = '') {
            return _batch(() => {
                try {
                    const n = sanitizeAmount(amount);
                    if (n <= 0) return { ok: false, error: 'invalid' };
                    if (state.balance.coins < n) return { ok: false, error: 'لا توجد عملات كافية' };

                    state.balance.coins -= n;
                    pushTx({
                        type: 'spend', currency: 'coins', amount: -n,
                        reason: String(reason || 'spend'),
                        balance: state.balance.coins
                    });
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

        /* ---------- خصم أحجار (جديد — للمرونة) ---------- */
        spendGems(amount, reason = '') {
            return _batch(() => {
                try {
                    const n = sanitizeAmount(amount);
                    if (n <= 0) return { ok: false, error: 'invalid' };
                    if (state.balance.gems < n) return { ok: false, error: 'لا توجد أحجار كافية' };

                    state.balance.gems -= n;
                    pushTx({
                        type: 'spend', currency: 'gems', amount: -n,
                        reason: String(reason || 'spend'),
                        balance: state.balance.gems
                    });
                    saveState();
                    emitBalanceChanged();
                    emit('currencySpent', { type: 'gems', amount: n, reason, balance: state.balance.gems });
                    return { ok: true };
                } catch (e) {
                    console.error(LOG_PREFIX, 'spendGems error:', e);
                    return { ok: false, error: 'exception' };
                }
            });
        },

        /* ---------- إضافة XP يدوياً (جديد — مرن) ---------- */
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
                } catch (e) {
                    return { ok: false, error: 'exception' };
                }
            });
        },

        /* ---------- المكافآت اليومية ---------- */
        getDailyStatus() {
            try {
                const today = todayKey();
                const last = state.daily.lastClaimDate;
                const gap = last ? daysBetween(last, today) : Infinity;

                // عرض سلسلة صحيحة دون الكتابة في الحالة (تُكتب في claimDaily)
                let streak = state.daily.streak || 0;
                let claimedDays = Array.isArray(state.daily.claimedDays) ? [...state.daily.claimedDays] : [];

                if (gap > 1 && last !== null) {
                    streak = 0;
                    claimedDays = [];
                }

                const currentIndex = streak % 7;
                const canClaim = (last !== today);
                const rewards = DAILY_REWARDS.map((r, i) => {
                    const claimed = claimedDays.includes(i);
                    return {
                        ...r,
                        claimed,
                        isCurrent: (i === currentIndex) && !claimed && canClaim
                    };
                });

                return { rewards, streak, canClaim, currentDay: currentIndex + 1 };
            } catch (e) {
                console.error(LOG_PREFIX, 'getDailyStatus error:', e);
                return { rewards: DAILY_REWARDS.map(r => ({ ...r, claimed: false, isCurrent: false })), streak: 0, canClaim: false, currentDay: 1 };
            }
        },

        claimDaily(index) {
            return _batch(() => {
                try {
                    const idx = Number(index);
                    if (!Number.isInteger(idx) || idx < 0 || idx > 6) {
                        return { ok: false, error: 'invalid index' };
                    }

                    const today = todayKey();
                    const last = state.daily.lastClaimDate;
                    const gap = last ? daysBetween(last, today) : Infinity;

                    // إصلاح: إعادة تعيين claimedDays عند انقطاع السلسلة
                    if (gap > 1 && last !== null) {
                        state.daily.streak = 0;
                        state.daily.claimedDays = [];
                    }

                    const status = this.getDailyStatus();
                    if (!status.canClaim) return { ok: false, error: 'تم الاستلام مسبقاً' };
                    if (idx !== status.currentDay - 1) return { ok: false, error: 'غير متاح' };

                    const rw = DAILY_REWARDS[idx];
                    if (!rw) return { ok: false, error: 'invalid reward' };

                    if (rw.type === 'coins') {
                        this.addCoins(rw.amount, 'مكافأة يومية', { silent: true });
                    } else if (rw.type === 'gems') {
                        this.addGems(rw.amount, 'مكافأة يومية', { silent: true });
                    }

                    state.daily.streak = (gap === 1)
                        ? (state.daily.streak || 0) + 1
                        : 1;
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
                return ACHIEVEMENTS_DEF.map(def => {
                    const s = state.achievements[def.key] || { progress: 0, claimed: false };
                    const progress = clamp(sanitizeProgress(s.progress), 0, def.target);
                    return {
                        ...def,
                        progress,
                        completed: progress >= def.target,
                        claimed: !!s.claimed,
                        percent: Math.round((progress / def.target) * 100)
                    };
                });
            } catch (e) {
                return ACHIEVEMENTS_DEF.map(def => ({ ...def, progress: 0, completed: false, claimed: false, percent: 0 }));
            }
        },

        updateAchievement(key, delta) {
            return _batch(() => {
                try {
                    const def = ACHIEVEMENTS_DEF.find(a => a.key === key);
                    if (!def) return;
                    const d = sanitizeProgress(delta);
                    if (d === 0) return;

                    if (!state.achievements[key]) {
                        state.achievements[key] = { progress: 0, claimed: false };
                    }
                    const before = sanitizeProgress(state.achievements[key].progress);
                    state.achievements[key].progress = clamp(before + d, 0, def.target);

                    saveState();

                    if (before < def.target && state.achievements[key].progress >= def.target) {
                        emit('achievementCompleted', { key, def });
                        maybeToast(`🏆 إنجاز مكتمل: ${def.name}`, 'success');
                    }
                    emitStateChanged();
                } catch (e) {
                    console.error(LOG_PREFIX, 'updateAchievement error:', e);
                }
            });
        },

        claimAchievement(key) {
            return _batch(() => {
                try {
                    const def = ACHIEVEMENTS_DEF.find(a => a.key === key);
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
                        silent: true,
                        idempotencyKey: 'ach:' + key
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
                    MISSIONS_DEF.forEach(def => {
                        state.missions[def.key] = { progress: 0, claimed: false };
                    });
                    saveState();
                }
            } catch (e) { /* تجاهل */ }
        },

        getMissions() {
            try {
                this._ensureMissionsReset();
                return MISSIONS_DEF.map(def => {
                    const s = state.missions[def.key] || { progress: 0, claimed: false };
                    const progress = clamp(sanitizeProgress(s.progress), 0, def.target);
                    return {
                        ...def,
                        progress,
                        completed: progress >= def.target,
                        claimed: !!s.claimed,
                        percent: Math.round((progress / def.target) * 100)
                    };
                });
            } catch (e) {
                return MISSIONS_DEF.map(def => ({ ...def, progress: 0, completed: false, claimed: false, percent: 0 }));
            }
        },

        updateMission(key, delta) {
            return _batch(() => {
                try {
                    this._ensureMissionsReset();
                    const def = MISSIONS_DEF.find(m => m.key === key);
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
                } catch (e) {
                    console.error(LOG_PREFIX, 'updateMission error:', e);
                }
            });
        },

        claimMission(key) {
            return _batch(() => {
                try {
                    this._ensureMissionsReset();
                    const def = MISSIONS_DEF.find(m => m.key === key);
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
                const def = CHESTS_DEF[key];
                if (!def) return null;
                const s = state.chests[key] || {};
                const last = Number(s.lastOpenTs) || 0;
                const remaining = Math.max(0, (last + def.cooldownMs) - Date.now());
                return {
                    ready: remaining === 0,
                    remainingMs: remaining,
                    cost: { ...def.cost }
                };
            } catch (e) {
                return null;
            }
        },

        openChest(key) {
            return _batch(() => {
                try {
                    const def = CHESTS_DEF[key];
                    if (!def) return { ok: false, error: 'غير موجود' };

                    const st = this.getChestStatus(key);
                    if (!st) return { ok: false, error: 'invalid' };
                    if (!st.ready) return { ok: false, error: 'انتظر قليلاً' };

                    // تحقق من التكلفة قبل أي تعديل
                    if (def.cost.coins && state.balance.coins < def.cost.coins) {
                        return { ok: false, error: 'تحتاج ' + def.cost.coins + ' 🪙' };
                    }
                    if (def.cost.gems && state.balance.gems < def.cost.gems) {
                        return { ok: false, error: 'تحتاج ' + def.cost.gems + ' 💎' };
                    }

                    // لفة المكافأة قبل الخصم
                    const totalWeight = def.rewards.reduce((a, r) => a + r.weight, 0);
                    let roll = Math.random() * totalWeight;
                    let picked = def.rewards[0];
                    for (const r of def.rewards) {
                        if (roll < r.weight) { picked = r; break; }
                        roll -= r.weight;
                    }
                    const amount = randInt(picked.min, picked.max);

                    // خصم
                    if (def.cost.coins) {
                        const sp = this.spendCoins(def.cost.coins, 'صندوق');
                        if (!sp.ok) return sp;
                    }
                    if (def.cost.gems) {
                        const sp = this.spendGems(def.cost.gems, 'صندوق');
                        if (!sp.ok) return sp;
                    }

                    // منح
                    if (picked.type === 'coins') {
                        this.addCoins(amount, 'صندوق', { silent: true });
                    } else if (picked.type === 'gems') {
                        this.addGems(amount, 'صندوق', { silent: true });
                    } else if (picked.type === 'xp') {
                        addXp(amount);
                    }

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
                    if (result && typeof result === 'object') {
                        outcome = result.result || result.outcome || 'unknown';
                    }

                    state.totals.gamesPlayed += 1;

                    if (outcome === 'win') {
                        state.totals.wins += 1;
                        ['win1', 'win5', 'win20', 'win50'].forEach(k => this.updateAchievement(k, 1));
                        addXp(50);
                    } else if (outcome === 'loss') {
                        state.totals.losses += 1;
                        addXp(10);
                    } else {
                        addXp(20);
                    }

                    ['play10', 'play50', 'play100'].forEach(k => this.updateAchievement(k, 1));

                    // تحديث المهام اختياري (معطّل افتراضياً حفاظاً على السلوك الأصلي)
                    if (options.updateMissions === true) {
                        this.updateMission('play1', 1);
                        if (outcome === 'win') this.updateMission('win1', 1);
                    }

                    saveState();
                    emitStateChanged();
                    emit('gameRecorded', { outcome, totals: { ...state.totals } });
                } catch (e) {
                    console.error(LOG_PREFIX, 'recordGame error:', e);
                }
            });
        },

        recordCapture(count = 1, options = {}) {
            return _batch(() => {
                try {
                    const n = sanitizeAmount(count, true);
                    if (n <= 0) return;

                    state.totals.captures += n;
                    ['capture10', 'capture50', 'capture100'].forEach(k => this.updateAchievement(k, n));

                    if (options.updateMissions === true) {
                        this.updateMission('capture3', n);
                        this.updateMission('capture5', n);
                    }

                    saveState();
                    emitStateChanged();
                    emit('captureRecorded', { count: n, total: state.totals.captures });
                } catch (e) {
                    console.error(LOG_PREFIX, 'recordCapture error:', e);
                }
            });
        },

        /* ---------- سجل المعاملات (جديد) ---------- */
        getTransactionLog(limit = 20) {
            try {
                const log = Array.isArray(state.transactions) ? state.transactions : [];
                const n = Math.max(1, Math.min(Number(limit) || 20, TX_LIMIT));
                return log.slice(-n).map(t => ({ ...t }));
            } catch (e) {
                return [];
            }
        },

        /* ---------- الحالة الكاملة / التصدير (جديد) ---------- */
        getState() {
            try { return deepClone(state); }
            catch (e) { return null; }
        },

        exportState() {
            try { return JSON.stringify(state); }
            catch (e) { return null; }
        },

        importState(obj, options = {}) {
            return _batch(() => {
                try {
                    if (typeof obj === 'string') obj = JSON.parse(obj);
                    if (!obj || typeof obj !== 'object') return { ok: false, error: 'invalid' };

                    if (options.merge === true) {
                        mergeDeep(state, obj);
                    } else {
                        state = validateState(mergeDeep(deepClone(DEFAULT_STATE), obj));
                    }
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

        /* ---------- إشعار يدوي (جديد) ---------- */
        notify(message, type = 'info') {
            maybeToast(message, type);
        },

        /* ---------- تفعيل مزامنة سحابية (Supabase) ---------- */
        enableCloudSync(client) {
            if (!client) return false;
            _cloudSync.client = client;
            _cloudSync.enabled = true;
            return true;
        },

        disableCloudSync() {
            _cloudSync.enabled = false;
            _cloudSync.client = null;
        },

        /* ---------- إعادة تعيين شاملة ---------- */
        resetAll() {
            return _batch(() => {
                try {
                    state = deepClone(DEFAULT_STATE);
                    _idempotencyMap.clear();
                    _notifyDedupe.clear();
                    saveState();
                    emitBalanceChanged();
                    emitStateChanged();
                    emit('reset', {});
                    maybeToast('♻️ تم إعادة تعيين النظام', 'info');
                    return { ok: true };
                } catch (e) {
                    return { ok: false, error: 'exception' };
                }
            });
        }
    };

    /* ============================================================
       14) التهيئة والتصدير
       ============================================================ */
    window.RewardsSystem = RewardsSystem;

    function _emitInitial() {
        emitBalanceChanged();
        emitStateChanged();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _emitInitial, { once: true });
    } else {
        setTimeout(_emitInitial, 0);
    }

    console.log(`${LOG_PREFIX} 🪙 v${VERSION} — نظام العملات الاحترافي جاهز!`);
})();
