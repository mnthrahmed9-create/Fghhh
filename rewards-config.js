/* ============================================================
   rewards-config.js
   ============================================================
   ملف التحديد — كل الأرقام والقيم والتعريفات هنا فقط.
   عدّل هذا الملف لتغيير سلوك النظام دون لمس منطق التنفيذ.
   ============================================================ */

window.REWARDS_CONFIG = {

    /* ---------- إصدار ومفتاح التخزين ---------- */
    version: '1.0.0',
    storageKey: 'monsterChessRewards_v1',

    /* ---------- الرصيد الابتدائي للاعب الجديد ---------- */
    initialBalance: {
        coins:    500,   // 🪙 عملات
        gems:     50,    // 💎 جواهر
        trophies: 0,     // ⭐ كؤوس
        xp:       0,     // نقاط الخبرة
        level:    1      // المستوى
    },

    /* ---------- منحنى الخبرة (XP تراكمي لكل مستوى) ----------
       index = رقم المستوى - 1
       levelCurve[0]  = 0     → المستوى 1 يحتاج 0 XP
       levelCurve[1]  = 100   → المستوى 2 يحتاج 100 XP
       levelCurve[2]  = 300   → المستوى 3 يحتاج 300 XP
       ... وهكذا
    ---------------------------------------------------------- */
    levelCurve: [
        0,       // Lv 1
        100,     // Lv 2
        300,     // Lv 3
        600,     // Lv 4
        1000,    // Lv 5
        1500,    // Lv 6
        2200,    // Lv 7
        3000,    // Lv 8
        4000,    // Lv 9
        5500,    // Lv 10
        7500,    // Lv 11
        10000,   // Lv 12
        13000,   // Lv 13
        17000,   // Lv 14
        22000,   // Lv 15
        28000,   // Lv 16
        36000,   // Lv 17
        45000,   // Lv 18
        55000,   // Lv 19
        70000    // Lv 20
    ],

    /* ---------- مكافأة الترقية (لكل مستوى) ---------- */
    levelUpBonus: {
        coinsPerLevel: 100,
        gemsPerLevel:  2
    },

    /* ---------- المكافآت اليومية — دورة 7 أيام ---------- */
    dailyRewards: [
        { day: 1, icon: '🪙', type: 'coins', amount: 100 },
        { day: 2, icon: '🪙', type: 'coins', amount: 200 },
        { day: 3, icon: '💎', type: 'gems',  amount: 5   },
        { day: 4, icon: '🪙', type: 'coins', amount: 350 },
        { day: 5, icon: '💎', type: 'gems',  amount: 10  },
        { day: 6, icon: '🪙', type: 'coins', amount: 500 },
        { day: 7, icon: '🎁', type: 'gems',  amount: 25  }
    ],
    dailyXPBonus: 20,   // XP إضافي عند استلام المكافأة اليومية

    /* ---------- الإنجازات ---------- */
    achievements: [
        { key: 'win1',       name: '🏆 الفوز الأول',       target: 1,   reward: 100  },
        { key: 'win5',       name: '🏆 فائز محترف',         target: 5,   reward: 300  },
        { key: 'win20',      name: '🏆 بطل الأساطير',       target: 20,  reward: 1000 },
        { key: 'capture10',  name: '⚔️ قاهر القطع',         target: 10,  reward: 200  },
        { key: 'capture50',  name: '⚔️ سفاح الرقعة',        target: 50,  reward: 600  },
        { key: 'play10',     name: '♟️ لاعب نشط',            target: 10,  reward: 250  },
        { key: 'play50',     name: '♟️ محترف',              target: 50,  reward: 800  },
        { key: 'checkmate5', name: '👑 ملك الكش مات',       target: 5,   reward: 500  }
    ],

    /* ---------- المهام اليومية (تُعاد كل يوم) ---------- */
    missions: [
        { key: 'play1',    name: '📅 لعب مباراة واحدة',   target: 1, reward: 50  },
        { key: 'win1',     name: '📅 الفوز بمباراة',       target: 1, reward: 100 },
        { key: 'capture3', name: '📅 إسقاط 3 قطع',         target: 3, reward: 75  }
    ],

    /* ---------- صناديق المكافآت ---------- */
    chests: {
        hero: {
            name: 'صندوق الأبطال',
            icon: '🧰',
            cost:       { coins: 500 },              // تكلفة الفتح
            cooldownMs: 10 * 60 * 1000,              // 10 دقائق انتظار
            /* جدول الجوائز — الوزن يحدد الاحتمالية */
            rewards: [
                { weight: 50, type: 'coins', min: 100, max: 300 },
                { weight: 30, type: 'coins', min: 300, max: 800 },
                { weight: 15, type: 'gems',  min: 3,   max: 10  },
                { weight: 5,  type: 'gems',  min: 10,  max: 25  }
            ]
        }
    },

    /* ---------- XP من أحداث اللعب ---------- */
    xpRewards: {
        win:      50,
        draw:     20,
        loss:     10,
        capture:  5      // لكل قطعة تُسقط
    }
};
