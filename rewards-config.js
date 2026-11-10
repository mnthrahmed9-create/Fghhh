// ═══════════════════════════════════════════════════════════════
// ⭐⭐ إعدادات المكافآت - عدّل هنا فقط ⭐⭐
// ═══════════════════════════════════════════════════════════════
window.REWARDS_CONFIG = {

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
                { type: 'coins',    min: 300,  max: 1200, weight: 60 },
                { type: 'gems',     min: 3,    max: 15,   weight: 30 },
                { type: 'trophies', min: 20,   max: 80,   weight: 10 }
            ]
        }
    },

    achievements: {
        win1:      { name: '🐲 أول انتصار',   target: 1,   reward: 300  },
        win5:      { name: '👑 ملك الرقعة',    target: 5,   reward: 1500 },
        capture10: { name: '⚔️ سفاح',          target: 10,  reward: 800  },
        play20:    { name: '🎮 محارب مثابر',   target: 20,  reward: 2000 }
    },

    missions: {
        play1:    { name: '🎮 العب مباراة',    target: 1, reward: 100 },
        win1:     { name: '🏆 اربح مباراة',    target: 1, reward: 250 },
        capture3: { name: '⚔️ أسر 3 قطع',      target: 3, reward: 150 }
    }
};
