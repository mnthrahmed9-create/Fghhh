<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Monster Chess 3D — المملكة</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
<script src="rewards-config.js"></script>
<script src="rewards.js"></script>
<script src="board.js"></script>

<style>
    :root{
        --navy-deep:#0B1A2E;--navy:#132B45;--navy-light:#1E3A5F;
        --charcoal:#1A1A1E;--charcoal-light:#2A2C33;--charcoal-soft:#34363E;
        --metal:#5C6470;--metal-light:#8A919C;--metal-soft:#B4BAC4;
        --champagne:#C9A96A;--champagne-light:#D9C08E;--champagne-dark:#A8894F;
        --silver:#C4C9D1;--silver-dark:#A8B0BB;
        --ivory:#F2EAD9;--ivory-dark:#E0D5BD;--ivory-soft:#EDE4D0;
        --bronze:#9C7A4E;--bronze-dark:#6E5435;
        --coral:#B97C6E;--coral-dark:#8B5A4E;--white:#FFFFFF;
        --font-main:'Cairo',sans-serif;
    }
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
    html,body{height:100%;overscroll-behavior:none;}
    body{
        font-family:var(--font-main);
        background:linear-gradient(180deg,var(--navy-deep) 0%,var(--navy) 35%,var(--navy-light) 65%,var(--charcoal-light) 100%);
        height:100vh;height:100dvh;
        overflow:hidden;display:flex;flex-direction:column;position:relative;color:var(--ivory);
        touch-action:manipulation;
    }
    .menu-top-bar{position:relative;z-index:10;display:flex;justify-content:space-between;align-items:flex-start;padding:15px}
    .profile-box{display:flex;align-items:center;background:linear-gradient(135deg,var(--charcoal-light),var(--charcoal));border:1.5px solid var(--champagne-dark);border-radius:15px;padding:5px 15px 5px 5px;box-shadow:0 4px 12px rgba(0,0,0,.5);cursor:pointer}
    .avatar-frame{width:50px;height:50px;border-radius:50%;background:radial-gradient(circle,var(--ivory),var(--ivory-dark));border:1.5px solid var(--silver);display:flex;justify-content:center;align-items:center;font-size:28px;box-shadow:0 0 8px rgba(201,169,106,.35);position:relative}
    .level-badge{position:absolute;bottom:-5px;right:-5px;background:linear-gradient(180deg,var(--champagne-light),var(--champagne-dark));color:var(--charcoal);font-size:10px;font-weight:900;padding:2px 6px;border-radius:10px;border:1px solid var(--charcoal)}
    .profile-info{margin-right:10px;display:flex;flex-direction:column;justify-content:center}
    .profile-name{font-size:14px;font-weight:700;color:var(--ivory);text-shadow:0 1px 2px #000}
    .profile-stars{font-size:12px;color:var(--champagne);font-weight:800;display:flex;align-items:center;gap:3px}
    .resources{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .res-pill{background:rgba(10,15,25,.85);border:1px solid var(--metal);border-radius:20px;padding:3px 8px 3px 3px;display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--ivory);box-shadow:inset 0 1px 3px rgba(196,201,209,.12)}
    .res-pill .icon{width:22px;height:22px;border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:14px}
    .res-pill.coin .icon{background:radial-gradient(circle,var(--champagne-light),var(--champagne-dark))}
    .res-pill.gem .icon{background:radial-gradient(circle,var(--silver),var(--metal))}
    .btn-plus{background:linear-gradient(180deg,var(--champagne-light),var(--champagne-dark));color:var(--charcoal);border:1.5px solid var(--ivory);border-radius:50%;width:20px;height:20px;font-weight:900;display:flex;justify-content:center;align-items:center;font-size:12px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.5)}
    .settings-btn{background:rgba(10,15,25,.85);border:1.5px solid var(--champagne);border-radius:50%;width:40px;height:40px;display:flex;justify-content:center;align-items:center;font-size:20px;color:var(--champagne);cursor:pointer;transition:transform .15s}
    .menu-side-panel{position:absolute;top:20%;z-index:10;display:flex;flex-direction:column;gap:15px}
    .menu-side-panel.left{left:10px}.menu-side-panel.right{right:10px}
    .side-btn{background:linear-gradient(180deg,var(--charcoal-light),var(--charcoal));border:1.5px solid var(--champagne-dark);border-radius:15px;width:60px;height:65px;display:flex;flex-direction:column;justify-content:center;align-items:center;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.5);position:relative}
    .side-btn:active{transform:scale(.95)}
    .side-btn span{font-size:24px}
    .side-btn small{font-size:9px;font-weight:700;margin-top:2px;color:var(--ivory)}
    .badge-red{position:absolute;top:-5px;right:-5px;background:var(--coral);color:var(--ivory);width:18px;height:18px;border-radius:50%;font-size:10px;font-weight:900;display:flex;justify-content:center;align-items:center;border:2px solid var(--charcoal);animation:pulse 2.2s infinite}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
    .chest-box{background:linear-gradient(180deg,var(--charcoal-light),var(--charcoal));border:1.5px solid var(--champagne-dark);border-radius:15px;width:80px;padding:8px;display:flex;flex-direction:column;align-items:center;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.5);cursor:pointer}
    .chest-box span{font-size:35px;margin-bottom:5px;animation:float 3s infinite ease-in-out}
    .chest-box small{font-size:9px;color:var(--champagne);font-weight:800}
    .chest-box .timer{font-size:11px;font-weight:900;margin-top:2px;font-family:monospace;color:var(--ivory)}
    .menu-main-center{position:relative;z-index:10;flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 20px;margin-top:-10px}
    .logo-container{text-align:center;margin-bottom:16px;position:relative;animation:logoFloat 5s ease-in-out infinite}
    @keyframes logoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    .logo-crown{font-size:clamp(40px,10vw,60px);position:absolute;top:-30px;left:50%;transform:translateX(-50%);filter:drop-shadow(0 4px 6px rgba(0,0,0,.8)) drop-shadow(0 0 10px rgba(201,169,106,.4))}
    .logo-text{font-size:clamp(35px,9vw,55px);font-weight:900;color:var(--champagne);text-shadow:0 2px 0 var(--champagne-dark),0 4px 0 var(--bronze-dark),0 6px 12px rgba(0,0,0,.85);letter-spacing:2px;margin:0;font-family:Arial,sans-serif}
    .logo-ribbon{background:linear-gradient(180deg,var(--bronze),var(--bronze-dark));color:var(--ivory);font-size:12px;font-weight:800;padding:3px 20px;border-radius:10px;display:inline-block;margin-top:-5px;box-shadow:0 3px 8px rgba(0,0,0,.5);border:1px solid var(--charcoal);transform:rotate(-2deg)}
    .btn-main{width:100%;max-width:350px;height:70px;border-radius:35px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;cursor:pointer;position:relative;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,.55),inset 0 3px 6px rgba(255,255,255,.15);border:2.5px solid var(--champagne-dark);font-family:var(--font-main);color:var(--ivory)}
    .btn-main:active{transform:translateY(5px)}
    .btn-main.online{background:linear-gradient(180deg,#24446B,#12263D)}
    .btn-main.computer{background:linear-gradient(180deg,#6A3F35,#3F241E)}
    .btn-main.customize{background:linear-gradient(180deg,#3A2E5C,#1E1736)}
    .btn-main .icon-circle{width:50px;height:50px;background:rgba(10,15,25,.4);border-radius:50%;border:1.5px solid var(--champagne);display:flex;justify-content:center;align-items:center;font-size:24px}
    .btn-main .text-box{text-align:center;flex:1}
    .btn-main h3{font-size:22px;font-weight:900;color:var(--ivory);text-shadow:0 2px 4px rgba(0,0,0,.8);margin-bottom:-3px}
    .btn-main p{font-size:10px;color:var(--silver);font-weight:600}
    .menu-bottom-bar{position:relative;z-index:10;display:flex;justify-content:center;gap:8px;padding:12px;background:linear-gradient(to top,rgba(10,15,25,.85),transparent)}
    .bottom-btn{width:56px;height:56px;background:linear-gradient(180deg,var(--charcoal-light),var(--charcoal));border:1.5px solid var(--champagne-dark);border-radius:14px;display:flex;flex-direction:column;justify-content:center;align-items:center;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.5)}
    .bottom-btn:active{transform:translateY(3px)}
    .bottom-btn span{font-size:22px}
    .bottom-btn small{font-size:8px;font-weight:800;margin-top:2px;color:var(--ivory)}
    .modal-overlay{position:fixed;inset:0;background:rgba(5,8,15,.88);z-index:200;display:flex;justify-content:center;align-items:center;opacity:0;pointer-events:none;transition:opacity .3s;padding:15px}
    .modal-overlay.active{opacity:1;pointer-events:auto}
    .modal-content{background:linear-gradient(160deg,var(--charcoal-light),var(--charcoal));border:2px solid var(--champagne-dark);border-radius:20px;width:100%;max-width:460px;padding:20px;box-shadow:0 12px 30px rgba(0,0,0,.85);transform:scale(.9);transition:transform .3s;text-align:right;max-height:88vh;overflow-y:auto}
    .modal-overlay.active .modal-content{transform:scale(1)}
    .modal-content h2{color:var(--champagne);text-align:center;margin-bottom:14px;text-shadow:0 2px 4px #000;font-size:19px}
    .modal-section-title{color:var(--champagne);font-size:13px;font-weight:800;margin:14px 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(201,169,106,.25);display:flex;align-items:center;gap:6px}
    .modal-close{background:linear-gradient(180deg,var(--coral),var(--coral-dark));color:var(--ivory);border:1.5px solid var(--ivory-dark);padding:10px 24px;border-radius:20px;font-family:var(--font-main);font-weight:800;font-size:14px;cursor:pointer;display:block;margin:16px auto 0;box-shadow:0 3px 8px rgba(0,0,0,.5)}
    .modal-close:active{transform:scale(.95)}
    .diff-btn{width:100%;height:58px;border-radius:29px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2.5px solid var(--champagne-dark);font-family:var(--font-main);font-size:19px;font-weight:900;color:var(--ivory);text-shadow:0 2px 4px rgba(0,0,0,.8)}
    .diff-btn:active{transform:translateY(4px)}
    .diff-btn.easy{background:linear-gradient(to bottom,#2E4A3E,#1A2E27)}
    .diff-btn.medium{background:linear-gradient(to bottom,#5C4A28,#3A2E19)}
    .diff-btn.hard{background:linear-gradient(to bottom,#6A3F35,#3F241E)}
    .setting-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(196,201,209,.15);font-weight:700;color:var(--ivory);gap:10px}
    .setting-row:last-of-type{border-bottom:none}
    .setting-row span{flex:1;min-width:0}
    input[type=checkbox]{width:24px;height:24px;accent-color:var(--champagne-dark);cursor:pointer;flex-shrink:0}
    input[type=range]{width:100px;accent-color:var(--champagne-dark);cursor:pointer;flex-shrink:0}
    .preset-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}
    .preset-btn{background:rgba(10,15,25,.6);border:1.5px solid var(--metal);border-radius:10px;padding:5px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:all .2s}
    .preset-btn:hover{border-color:var(--champagne)}
    .preset-btn.active{border-color:var(--champagne);box-shadow:0 0 12px rgba(201,169,106,.4);background:rgba(201,169,106,.1)}
    .preset-btn .swatches{display:flex;height:26px;border-radius:6px;overflow:hidden;border:1px solid rgba(0,0,0,.5)}
    .preset-btn .swatches>div{flex:1}
    .preset-btn .preset-name{font-size:9px;font-weight:700;color:var(--ivory);text-align:center;line-height:1.1}
    .color-list{display:flex;flex-direction:column;gap:5px}
    .color-row{display:flex;justify-content:space-between;align-items:center;background:rgba(10,15,25,.5);padding:6px 11px;border-radius:10px;border:1px solid rgba(201,169,106,.18)}
    .color-row span{font-size:12px;font-weight:700;color:var(--ivory)}
    .color-row input[type=color]{width:44px;height:32px;border:1.5px solid var(--champagne-dark);border-radius:8px;background:transparent;cursor:pointer;padding:0;-webkit-appearance:none;appearance:none}
    .color-row input[type=color]::-webkit-color-swatch-wrapper{padding:2px}
    .color-row input[type=color]::-webkit-color-swatch{border:none;border-radius:5px}
    .camera-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
    .cam-btn{background:linear-gradient(180deg,var(--charcoal-light),var(--charcoal));border:1.5px solid var(--champagne-dark);color:var(--ivory);padding:10px 4px;border-radius:10px;font-family:var(--font-main);font-weight:800;font-size:10px;cursor:pointer}
    .cam-btn:active{transform:scale(.95)}
    .background-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
    .bg-btn{background:linear-gradient(180deg,var(--charcoal-light),var(--charcoal));border:1.5px solid var(--champagne-dark);color:var(--ivory);padding:12px 4px;border-radius:10px;font-family:var(--font-main);font-weight:800;font-size:10px;cursor:pointer;transition:all .2s}
    .bg-btn.active{border-color:var(--champagne);box-shadow:0 0 12px rgba(201,169,106,.5);background:rgba(201,169,106,.15);color:var(--champagne)}
    .reset-btn{width:100%;margin-top:10px;padding:9px;border-radius:10px;background:rgba(185,124,110,.2);border:1.5px solid var(--coral);color:var(--coral);font-family:var(--font-main);font-weight:800;font-size:12px;cursor:pointer}
    #gameScreen{display:none;position:fixed;inset:0;background:linear-gradient(to bottom,var(--navy-deep) 0%,var(--navy) 55%,var(--charcoal) 100%);flex-direction:column;z-index:50;overflow:hidden}
    #gameScreen.active{display:flex}
    .game-header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:linear-gradient(180deg,rgba(10,15,25,.85),transparent);border-bottom:1px solid rgba(201,169,106,.25);gap:6px}
    .back-btn{background:linear-gradient(180deg,var(--charcoal-light),var(--charcoal));border:1.5px solid var(--champagne-dark);color:var(--champagne);padding:7px 12px;border-radius:20px;font-family:var(--font-main);font-weight:800;font-size:12px;cursor:pointer}
    .game-title{color:var(--champagne);font-weight:900;font-size:14px;text-shadow:0 2px 4px #000;white-space:nowrap}
    .game-level-select{background:rgba(10,15,25,.85);border:1.5px solid var(--champagne-dark);border-radius:20px;color:var(--champagne);padding:6px 8px;font-family:var(--font-main);font-weight:800;font-size:11px;cursor:pointer}
    .game-settings-btn{width:34px!important;height:34px!important;padding:0!important;border-radius:50%!important;display:flex!important;justify-content:center!important;align-items:center!important;font-size:16px!important;flex-shrink:0}
    #game{flex:1;width:100%;min-height:0;touch-action:none;overflow:hidden;position:relative}
    #game canvas{display:block}
    .game-controls{padding:10px 12px 14px;background:linear-gradient(0deg,rgba(10,15,25,.92),transparent);border-top:1px solid rgba(201,169,106,.25)}
    #status{color:var(--champagne);font-weight:900;font-size:14px;text-align:center;margin-bottom:8px;text-shadow:0 1px 3px rgba(0,0,0,.8);min-height:20px}
    .game-actions{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
    .game-btn{background:linear-gradient(180deg,var(--charcoal-light),var(--charcoal));border:1.5px solid var(--champagne-dark);color:var(--ivory);padding:9px 14px;border-radius:20px;font-family:var(--font-main);font-weight:800;font-size:12px;cursor:pointer}
    .game-btn.gold{background:linear-gradient(180deg,var(--champagne-light),var(--champagne-dark));color:var(--charcoal)}
    .game-btn.red{background:linear-gradient(180deg,var(--coral),var(--coral-dark));color:var(--ivory)}
    #moves{max-height:44px;overflow-y:auto;color:var(--silver);font-size:11px;text-align:center;margin-top:8px;padding:5px;background:rgba(10,15,25,.6);border-radius:10px;word-wrap:break-word}
    #promotion{display:none;padding:10px;background:rgba(10,15,25,.85);border:1.5px solid var(--champagne-dark);border-radius:15px;margin-top:8px;text-align:center}
    #promotion strong{display:block;margin-bottom:6px;color:var(--champagne);font-size:12px}
    #promotion .game-actions{gap:5px}
    .reward-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
    .reward-day{background:rgba(10,15,25,.6);border:1.5px solid var(--metal);border-radius:12px;padding:8px 4px;text-align:center}
    .reward-day.claimed{opacity:.45}
    .reward-day.current{border-color:var(--champagne);box-shadow:0 0 12px rgba(201,169,106,.35);transform:scale(1.03)}
    .reward-day .day-num{font-size:9px;font-weight:800;color:var(--silver);margin-bottom:4px}
    .reward-day .day-icon{font-size:22px;margin-bottom:4px;display:block}
    .reward-day .day-val{font-size:10px;font-weight:900;color:var(--champagne)}
    .claim-btn{background:linear-gradient(180deg,var(--champagne-light),var(--champagne-dark));color:var(--charcoal);border:none;border-radius:10px;padding:4px 8px;font-weight:900;font-size:10px;cursor:pointer;margin-top:4px;width:100%}
    .claim-btn:disabled{background:var(--charcoal-soft);color:var(--metal);cursor:not-allowed}
    .chest-anim-container{display:flex;justify-content:center;margin:18px 0}
    .chest-anim{font-size:76px;animation:chestShake .6s infinite}
    @keyframes chestShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg) scale(1.03)}50%{transform:rotate(8deg) scale(1.03)}75%{transform:rotate(-8deg) scale(1.03)}}
    .achieve-row,.mission-row{background:rgba(10,15,25,.55);padding:11px;border-radius:12px;margin-bottom:9px;border:1px solid rgba(201,169,106,.18);color:var(--ivory)}
    .achieve-row b,.mission-row b{font-size:12px;color:var(--ivory)}
    .achieve-row .prog,.mission-row .reward{color:var(--champagne);font-weight:900;font-size:11px}
    .progress-bar{width:100%;height:7px;background:rgba(196,201,209,.15);border-radius:5px;margin-top:5px;overflow:hidden}
    .progress-fill{height:100%;background:linear-gradient(90deg,var(--bronze),var(--champagne));border-radius:5px;transition:width .3s}
    #toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(20px);background:linear-gradient(135deg,rgba(30,35,45,.97),rgba(10,15,25,.97));color:var(--champagne);padding:11px 22px;border-radius:20px;border:1.5px solid var(--champagne-dark);font-weight:800;font-size:13px;opacity:0;pointer-events:none;transition:all .3s;z-index:9999;max-width:90vw;text-align:center}
    #toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    #splash{position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;opacity:1;transition:opacity 1s ease}
    #splash.hide{opacity:0;pointer-events:none}
    #splash .splash-vignette{position:absolute;inset:0;background:radial-gradient(circle at center,#1A1A1E 0%,#0B1018 55%,#000 100%)}
    #splash .company{margin:0;font-size:clamp(48px,15vw,120px);font-weight:900;letter-spacing:16px;background:linear-gradient(180deg,var(--ivory) 0%,var(--champagne-light) 30%,var(--champagne-dark) 50%,var(--champagne-light) 70%,var(--ivory) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;opacity:0;transform:scale(.4);animation:companyIn 1.4s cubic-bezier(.2,.9,.3,1.1) .2s forwards}
    @keyframes companyIn{60%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
    #splash .tagline{margin-top:22px;color:var(--silver);font-size:14px;font-weight:700;letter-spacing:14px;opacity:0;animation:tagIn .9s ease 1.4s forwards}
    @keyframes tagIn{to{opacity:1}}
    #bg3d{position:fixed;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg,#08141f 0%,#050a12 60%,#02040a 100%);}
    #bgVignette{position:fixed;inset:0;z-index:1;pointer-events:none;background:radial-gradient(ellipse 118% 74% at 50% 44%,rgba(0,0,0,0) 30%,rgba(2,6,14,.30) 68%,rgba(0,0,0,.72) 100%),linear-gradient(to bottom,rgba(3,6,12,.42) 0%,rgba(0,0,0,0) 20%,rgba(0,0,0,0) 74%,rgba(2,4,9,.72) 100%);}
</style>
</head>
<body>

<div id="bg3d"></div>
<div id="bgVignette"></div>

<div id="splash">
    <div class="splash-vignette"></div>
    <div class="company-wrap"><div class="company">KOKTON</div></div>
    <div class="tagline">PRESENTS</div>
</div>

<div id="menuScreen" style="display:flex;flex-direction:column;height:100%;position:relative;">
    <header class="menu-top-bar">
        <div class="profile-box" onclick="showToast('الملف الشخصي')">
            <div class="avatar-frame">🦁<div class="level-badge" id="ui-level">1</div></div>
            <div class="profile-info">
                <div class="profile-name">منتظر احمد</div>
                <div class="profile-stars">⭐ <span id="ui-trophies">0</span></div>
            </div>
        </div>
        <div class="resources">
            <div class="res-pill coin"><div class="icon">🪙</div><span id="ui-coins">0</span><div class="btn-plus" onclick="openModal('store')">+</div></div>
            <div class="res-pill gem"><div class="icon">💎</div><span id="ui-gems">0</span><div class="btn-plus" onclick="openModal('store')">+</div></div>
            <div class="settings-btn" onclick="openModal('settings')">⚙️</div>
        </div>
    </header>

    <div class="menu-side-panel left">
        <div class="side-btn" onclick="openModal('daily-rewards')"><span>🎁</span><small>مكافآت</small><div class="badge-red" id="daily-badge">!</div></div>
        <div class="side-btn" onclick="openModal('achievements')"><span>🏆</span><small>إنجازات</small></div>
        <div class="side-btn" onclick="openModal('missions')"><span>📅</span><small>مهام</small></div>
    </div>

    <div class="menu-side-panel right">
        <div class="chest-box" onclick="openModal('chest')"><span>🧰</span><small>صندوق الأبطال</small><div class="timer" id="chest-timer">جاهز!</div></div>
    </div>

    <main class="menu-main-center">
        <div class="logo-container">
            <div class="logo-crown">👑</div>
            <h1 class="logo-text">MONSTER</h1>
            <div class="logo-ribbon">CHESS 3D</div>
        </div>
        <button class="btn-main online" onclick="showToast('🌐 جاري الاتصال بالخادم...')">
            <div class="icon-circle">🌐</div>
            <div class="text-box"><h3>اللعب أونلاين</h3><p>واجه لاعبين من جميع أنحاء العالم</p></div>
            <div class="icon-circle" style="font-size:18px;">👥</div>
        </button>
        <button class="btn-main computer" onclick="openModal('difficulty')">
            <div class="icon-circle">🖥️</div>
            <div class="text-box"><h3>ضد الكمبيوتر</h3><p>العب مع الذكاء الاصطناعي</p></div>
            <div class="icon-circle">🤖</div>
        </button>
        <button class="btn-main customize" onclick="startPreview()">
            <div class="icon-circle">🎨</div>
            <div class="text-box"><h3>تخصيص الرقعة</h3><p>ألوان، خامات، وزوايا كاميرا</p></div>
            <div class="icon-circle">✨</div>
        </button>
    </main>

    <footer class="menu-bottom-bar">
        <div class="bottom-btn" onclick="openModal('store')"><span>🏪</span><small>المتجر</small></div>
        <div class="bottom-btn" onclick="showToast('🏆 الترتيب')"><span>🏆</span><small>الترتيب</small></div>
        <div class="bottom-btn" onclick="showToast('🥇 لوحة الشرف')"><span>🥇</span><small>الشرف</small></div>
        <div class="bottom-btn" onclick="openModal('customization')"><span>🎨</span><small>الرقعة</small></div>
        <div class="bottom-btn" onclick="showToast('🔗 مشاركة')"><span>🔗</span><small>مشاركة</small></div>
    </footer>
</div>

<div id="gameScreen">
    <div class="game-header">
        <button class="back-btn" onclick="backMenu()">← رجوع</button>
        <div class="game-title">♟️ MONSTER CHESS</div>
        <div style="display:flex;gap:5px;align-items:center;">
            <button class="back-btn game-settings-btn" onclick="openModal('customization')">🎨</button>
            <select class="game-level-select" id="level">
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
            </select>
        </div>
    </div>
    <div id="game"></div>
    <div class="game-controls">
        <div id="status">دورك الآن - الأبيض</div>
        <div class="game-actions">
            <button class="game-btn gold" onclick="newGame()">🔄 جديد</button>
            <button class="game-btn" onclick="undoMove()">↩️ تراجع</button>
            <button class="game-btn red" onclick="backMenu()">🏠 القائمة</button>
        </div>
        <div id="promotion">
            <strong>👑 اختر ترقية البيدق</strong>
            <div class="game-actions">
                <button class="game-btn gold" onclick="promote('q')">ملكة</button>
                <button class="game-btn gold" onclick="promote('r')">قلعة</button>
                <button class="game-btn gold" onclick="promote('b')">فيل</button>
                <button class="game-btn gold" onclick="promote('n')">حصان</button>
                <button class="game-btn red" onclick="cancelPromotion()">إلغاء</button>
            </div>
        </div>
        <div id="moves">سجل الحركات سيظهر هنا</div>
    </div>
</div>

<div class="modal-overlay" id="modal-difficulty">
    <div class="modal-content">
        <h2>⚔️ اختر الصعوبة</h2>
        <button class="diff-btn easy" onclick="startGame('easy')">سهل</button>
        <button class="diff-btn medium" onclick="startGame('medium')">متوسط</button>
        <button class="diff-btn hard" onclick="startGame('hard')">صعب</button>
        <button class="modal-close" onclick="closeModal('difficulty')">إلغاء</button>
    </div>
</div>

<div class="modal-overlay" id="modal-settings">
    <div class="modal-content">
        <h2>⚙️ الإعدادات</h2>
        <div class="modal-section-title">🔊 المؤثرات الصوتية</div>
        <div class="setting-row"><span>🔊 تشغيل المؤثرات</span><input type="checkbox" id="soundSetting" checked></div>
        <div class="setting-row"><span>🔉 مستوى المؤثرات</span><input type="range" id="soundVolume" min="0" max="100" value="70"></div>
        <div class="modal-section-title">🎵 الموسيقى الخلفية</div>
        <div class="setting-row"><span>🎵 تشغيل الموسيقى</span><input type="checkbox" id="musicSetting" checked></div>
        <div class="setting-row"><span>🎶 مستوى الموسيقى</span><input type="range" id="musicVolume" min="0" max="100" value="30"></div>
        <button class="modal-close" onclick="closeModal('settings')">حفظ وإغلاق</button>
    </div>
</div>

<div class="modal-overlay" id="modal-daily-rewards">
    <div class="modal-content">
        <h2>🎁 المكافآت اليومية</h2>
        <p style="text-align:center;font-size:12px;margin-bottom:12px;color:var(--silver);">سجل دخولك كل يوم للحصول على جوائز أسطورية!</p>
        <div class="reward-grid" id="rewardGrid"></div>
        <button class="modal-close" onclick="closeModal('daily-rewards')">إغلاق</button>
    </div>
</div>

<div class="modal-overlay" id="modal-chest">
    <div class="modal-content">
        <h2>🧰 صندوق الأبطال</h2>
        <p style="text-align:center;font-size:12px;color:var(--silver);">افتح الصندوق للحصول على جوائز عشوائية!</p>
        <div class="chest-anim-container"><div class="chest-anim" id="chestVisual">🎁</div></div>
        <button id="openChestBtn" onclick="openChestAction()" style="width:100%;padding:14px;border-radius:15px;border:1.5px solid var(--champagne-dark);background:linear-gradient(to bottom,var(--champagne-light),var(--champagne-dark));color:var(--charcoal);font-weight:900;font-size:15px;cursor:pointer;margin-bottom:10px;">افتح الصندوق (🪙 500)</button>
        <button class="modal-close" onclick="closeModal('chest')">إغلاق</button>
    </div>
</div>

<div class="modal-overlay" id="modal-achievements">
    <div class="modal-content"><h2>🏆 الإنجازات</h2><div id="achievementsList"></div><button class="modal-close" onclick="closeModal('achievements')">إغلاق</button></div>
</div>

<div class="modal-overlay" id="modal-missions">
    <div class="modal-content"><h2>📅 المهام اليومية</h2><div id="missionsList"></div><button class="modal-close" onclick="closeModal('missions')">إغلاق</button></div>
</div>

<div class="modal-overlay" id="modal-store">
    <div class="modal-content">
        <h2>🏪 المتجر</h2>
        <p style="text-align:center;margin-bottom:12px;color:var(--silver);">عناصر أسطورية قادمة قريباً!</p>
        <div class="achieve-row"><b>🐲 تنين ذهبي</b><span class="prog">🪙 2500</span></div>
        <div class="achieve-row"><b>👹 غول الظلام</b><span class="prog">🪙 1800</span></div>
        <div class="achieve-row"><b>🧿 رقعة الملك</b><span class="prog">💎 60</span></div>
        <button class="modal-close" onclick="closeModal('store')">إغلاق</button>
    </div>
</div>

<div class="modal-overlay" id="modal-customization">
    <div class="modal-content">
        <h2>🎨 تخصيص الرقعة</h2>
        <div class="modal-section-title">✨ مجموعات جاهزة</div>
        <div class="preset-grid" id="presetGrid"></div>
        <div class="modal-section-title">🎨 ألوان مخصصة</div>
        <div class="color-list" id="colorList"></div>
        <div class="modal-section-title">📷 زوايا الكاميرا</div>
        <div class="camera-grid" id="cameraGrid"></div>
        <div class="modal-section-title">🖼️ خلفية الرقعة</div>
        <div class="background-grid" id="backgroundGrid"></div>
        <button class="reset-btn" onclick="resetCustomization()">↺ استعادة الافتراضي</button>
        <button class="modal-close" onclick="closeModal('customization')">إغلاق</button>
    </div>
</div>

<div id="toast">رسالة</div>

<script>
(function(){
    'use strict';
    window.__APP_BASE__ = (location.protocol === 'file:')
        ? (window.location.href.replace(/index\.html.*$/,'').replace(/[^\/]*$/,''))
        : './';
    window.__IMPORTMAP_SUPPORTED__ = (typeof HTMLScriptElement.supports === 'function') && HTMLScriptElement.supports('importmap');
    if (window.__IMPORTMAP_SUPPORTED__) {
        const im = document.createElement('script');
        im.type = 'importmap';
        im.textContent = JSON.stringify({ imports: { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/", "chess": "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm" } });
        document.head.appendChild(im);
    } else {
        const umd = document.createElement('script');
        umd.src = 'https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js';
        umd.onload = () => {
            const oc = document.createElement('script'); oc.src = 'https://cdn.jsdelivr.net/npm/three@0.150.0/examples/js/controls/OrbitControls.js';
            oc.onload = () => {
                const chessLib = document.createElement('script'); chessLib.src = 'https://cdn.jsdelivr.net/npm/chess.js@0.13.4/chess.min.js';
                chessLib.onload = () => { window.__USE_UMD__ = true; window.dispatchEvent(new Event('libsReady')); };
                document.body.appendChild(chessLib);
            };
            document.body.appendChild(oc);
        };
        document.body.appendChild(umd);
    }
    window.SafeStorage = (function(){
        let mem = {};
        try {
            const t = '__mc_test__' + Date.now(); localStorage.setItem(t, '1'); localStorage.removeItem(t);
            return { getItem: k => { try { return localStorage.getItem(k); } catch(e){ return mem[k] != null ? mem[k] : null; } }, setItem: (k,v) => { try { localStorage.setItem(k,v); } catch(e){ mem[k]=v; } }, removeItem: k => { try { localStorage.removeItem(k); } catch(e){ delete mem[k]; } } };
        } catch(e){
            return { getItem: k => (k in mem) ? mem[k] : null, setItem: (k,v) => { mem[k]=v; }, removeItem: k => { delete mem[k]; } };
        }
    })();
})();
</script>

<script type="module" id="mainModule">
let THREE, Chess;
let EffectComposer, RenderPass, UnrealBloomPass, OutputPass;
try {
    THREE = await import('three');
    ({ Chess } = await import('chess'));
    ({ EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js'));
    ({ RenderPass }     = await import('three/addons/postprocessing/RenderPass.js'));
    ({ UnrealBloomPass }= await import('three/addons/postprocessing/UnrealBloomPass.js'));
    ({ OutputPass }     = await import('three/addons/postprocessing/OutputPass.js'));
} catch(err) {
    if (window.THREE && window.Chess) { THREE = window.THREE; Chess = window.Chess; }
    else { await new Promise(res => window.addEventListener('libsReady', res, { once: true })); THREE = window.THREE; Chess = window.Chess; }
}

const DEFAULT_SETTINGS = { sound: true, music: true, soundVolume: 0.70, musicVolume: 0.30 };
const DEFAULT_CUSTOM = { lightSquare:'#E8DEC8', darkSquare:'#1E2A3D', frame:'#2A2C33', accent:'#C9A96A', base:'#141519', lightColor:'#FFF0D0', boardBg:'forest' };
let currentCustom = { ...DEFAULT_CUSTOM };
let playerData = { customization:{ ...DEFAULT_CUSTOM }, settings: { ...DEFAULT_SETTINGS } };

// Audio Engine
const AudioEngine = {
    ctx: null, sfxGain: null, musicGain: null,
    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); this.sfxGain = this.ctx.createGain(); this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.ctx.destination); this.musicGain.connect(this.ctx.destination); this.updateVolumes();
    },
    updateVolumes() { if (!this.ctx) return; this.sfxGain.gain.value = playerData.settings.sound ? playerData.settings.soundVolume : 0; this.musicGain.gain.value = playerData.settings.music ? playerData.settings.musicVolume : 0; },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{}); },
    playTone(freq, opts = {}) { if (!this.ctx || !playerData.settings.sound) return; this.resume(); const { duration = 0.15, type = 'sine', gain = 0.5, startTime = this.ctx.currentTime } = opts; const osc = this.ctx.createOscillator(); const g = this.ctx.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, startTime); g.gain.setValueAtTime(0, startTime); g.gain.linearRampToValueAtTime(gain, startTime + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.155); osc.connect(g); g.connect(this.sfxGain); osc.start(startTime); osc.stop(startTime + 0.2); },
    sfxClick() { this.playTone(1200, { duration: 0.05, gain: 0.25 }); },
    sfxSelect() { this.playTone(660, { duration: 0.08, gain: 0.22 }); },
    sfxMove() { this.playTone(230, { duration: 0.10, type: 'triangle', gain: 0.32 }); },
    sfxCapture() { this.playTone(180, { duration: 0.18, type: 'triangle', gain: 0.45 }); },
    sfxCheck() { this.playTone(880, { duration: 0.12, gain: 0.35 }); },
    sfxCheckmate() { [784, 659, 523].forEach((f, i) => this.playTone(f, { duration: 0.30, type: 'triangle', gain: 0.42, startTime: this.ctx.currentTime + i*0.16 })); },
    sfxWin() { [523, 659, 783].forEach((f, i) => this.playTone(f, { duration: 0.42, type: 'triangle', gain: 0.38, startTime: this.ctx.currentTime + i*0.12 })); },
    sfxLose() { [440, 392, 349].forEach((f, i) => this.playTone(f, { duration: 0.40, type: 'sine', gain: 0.32, startTime: this.ctx.currentTime + i*0.15 })); },
    sfxNotify() { this.playTone(880, { duration: 0.18, gain: 0.28 }); }
};
['pointerdown', 'touchstart'].forEach(evt => document.addEventListener(evt, () => { AudioEngine.init(); AudioEngine.resume(); }, { once: true, passive: true }));

// Rewards System UI
function getRS() { return (typeof window.RewardsSystem !== 'undefined' && window.RewardsSystem) ? window.RewardsSystem : null; }
window.showToast = function(msg, duration=2400) { const t = document.getElementById("toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(window._toastTimer); window._toastTimer = setTimeout(() => t.classList.remove("show"), duration); AudioEngine.sfxNotify(); };
window.openModal = function(id){ const m = document.getElementById('modal-' + id); if(m) m.classList.add('active'); AudioEngine.sfxClick(); };
window.closeModal = function(id){ const m = document.getElementById('modal-' + id); if(m) m.classList.remove('active'); };

// Game Logic
const chess = new Chess();
let gameStarted = false;
let gameInitialized = false;
let selected = null, thinking = false, pendingPromotion = null;
let snapshots = [];

async function initGame3D(){
    if(gameInitialized) return;
    await window.BoardModule.init('game');
    gameInitialized = true;
    
    const renderer = window.BoardModule.getRenderer();
    const pieces = window.BoardModule.getPieces();
    const squares = window.BoardModule.getSquares();
    const camera = window.BoardModule.getCamera();

    let dx = 0, dy = 0;
    renderer.domElement.addEventListener("pointerdown", e => { dx = e.clientX; dy = e.clientY; });
    renderer.domElement.addEventListener("pointerup", e => {
        if(Math.hypot(e.clientX - dx, e.clientY - dy) < 10) onClick(e, renderer, pieces, squares, camera);
    });
    window.BoardModule.onResize();
}

function onClick(event, renderer, pieces, squares, camera) {
    if(!gameStarted || thinking || chess.isGameOver() || pendingPromotion || chess.turn() !== "w") return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, camera);
    const pieceHits = ray.intersectObjects(pieces.children, true);
    let clickedSquare = null;
    if(pieceHits.length > 0) { let obj = pieceHits[0].object; while(obj && !obj.userData.square) obj = obj.parent; if(obj) clickedSquare = obj.userData.square; }
    if(!clickedSquare) { const sqHits = ray.intersectObjects(squares, false); if(sqHits.length > 0) clickedSquare = sqHits[0].object.userData.square; }
    if(!clickedSquare) return;
    
    if(selected) {
        const moves = chess.moves({ square: selected, verbose: true }); const mv = moves.find(m => m.to === clickedSquare);
        if(mv) {
            if(mv.promotion) { pendingPromotion = { from: selected, to: clickedSquare }; document.getElementById("promotion").style.display = "block"; AudioEngine.sfxClick(); return; }
            saveMove(); executePlayerMove(selected, clickedSquare); return;
        }
        const target = chess.get(clickedSquare);
        if(target && target.color === "w") { selected = clickedSquare; window.BoardModule.showMoves(chess, selected); AudioEngine.sfxSelect(); return; }
        selected = null; window.BoardModule.resetColors(); return;
    }
    const piece = chess.get(clickedSquare);
    if(piece && piece.color === "w") { selected = clickedSquare; window.BoardModule.showMoves(chess, selected); AudioEngine.sfxSelect(); }
}

function saveMove(){ snapshots.push({ fen: chess.fen(), history: [...chess.history()] }); }
function updateStatus() {
    const status = document.getElementById("status");
    if(chess.isCheckmate()) { status.textContent = "🏆 كش مات! " + (chess.turn()==='w'?'الأسود':'الأبيض') + " فاز!"; return true; }
    if(chess.isDraw()) { status.textContent = "🤝 تعادل"; return true; }
    status.textContent = chess.turn()==='w' ? "دورك الآن - الأبيض" : "🤖 الكمبيوتر يفكر...";
    return false;
}

function makeMove(from, to, promotion="q") {
    const move = chess.move({ from, to, promotion }); if(!move) return false;
    window.BoardModule.draw(chess); window.BoardModule.resetColors(); selected = null;
    document.getElementById("moves").textContent = chess.history().join("  ");
    if(move.captured) AudioEngine.sfxCapture(); else AudioEngine.sfxMove();
    if(chess.isCheck() && !chess.isCheckmate()) AudioEngine.sfxCheck();
    return true;
}

function computer() {
    if(chess.isGameOver()) return;
    const moves = chess.moves(); if(!moves.length) return;
    const chosen = moves[Math.floor(Math.random()*moves.length)];
    if(chosen) {
        const result = chess.move(chosen);
        window.BoardModule.draw(chess);
        document.getElementById("moves").textContent = chess.history().join("  ");
        if(result && result.captured) AudioEngine.sfxCapture(); else AudioEngine.sfxMove();
        updateStatus();
    }
}

function executePlayerMove(from, to, promotion) {
    if(!makeMove(from, to, promotion)) return;
    document.getElementById("promotion").style.display = "none";
    if(updateStatus()) { AudioEngine.sfxCheckmate(); return; }
    thinking = true;
    setTimeout(() => { if(gameStarted && !chess.isGameOver()){ computer(); updateStatus(); } thinking = false; }, 350);
}

window.startGame = async function(level) {
    AudioEngine.sfxClick(); closeModal('difficulty');
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('gameScreen').classList.add('active');
    gameStarted = true;
    if(!gameInitialized) await initGame3D();
    window.newGame();
    setTimeout(() => window.BoardModule.onResize(), 300);
};

window.backMenu = function() {
    AudioEngine.sfxClick(); gameStarted = false;
    document.getElementById("gameScreen").classList.remove("active");
    document.getElementById("menuScreen").style.display = "flex";
};

window.newGame = function() {
    AudioEngine.sfxClick(); gameStarted = true; chess.reset(); snapshots = []; selected = null; pendingPromotion = null; thinking = false;
    document.getElementById("moves").textContent = "سجل الحركات سيظهر هنا";
    if(gameInitialized) { window.BoardModule.draw(chess); window.BoardModule.resetColors(); }
    updateStatus();
};

window.undoMove = function() {
    if(snapshots.length === 0) return;
    const snap = snapshots.pop(); chess.load(snap.fen); selected = null;
    if(gameInitialized) { window.BoardModule.draw(chess); window.BoardModule.resetColors(); }
    document.getElementById("moves").textContent = snap.history.join("  "); updateStatus();
};

window.promote = function(piece) {
    if(!pendingPromotion) return;
    const { from, to } = pendingPromotion; pendingPromotion = null;
    document.getElementById("promotion").style.display = "none";
    saveMove(); executePlayerMove(from, to, piece);
};
window.cancelPromotion = function() { pendingPromotion = null; document.getElementById("promotion").style.display = "none"; selected = null; };

// Customization UI
const PRESETS = [ { id:'marbleGold', name:'رخامي + ذهبي', cfg:{ lightSquare:'#EDE5D5', darkSquare:'#1A1A1E', frame:'#0B0B0E', accent:'#D4AF37', base:'#08080A', lightColor:'#FFE4B0' } }, { id:'ivoryCharcoal', name:'عاجي + فحمي', cfg:{ lightSquare:'#F2EAD9', darkSquare:'#1A1A1E', frame:'#2A2C33', accent:'#8A919C', base:'#141519', lightColor:'#F5F5FA' } } ];
const COLOR_LABELS = { lightSquare:'⬜ المربعات الفاتحة', darkSquare:'⬛ المربعات الداكنة', frame:'🖼️ الإطار الخارجي', accent:'✨ الحواف والزخارف', base:'🏛️ القاعدة السفلية', lightColor:'💡 لون الإضاءة' };
const CAMERA_PRESETS = { top: { label:'علوي 90°' }, front: { label:'أمامي' }, side: { label:'جانبي' }, angle45: { label:'45°' }, iso: { label:'Isometric' }, closeup: { label:'تقريب' } };

window.setBoardBackground = function(type) {
    currentCustom.boardBg = type; savePlayerData();
    if(gameInitialized) window.BoardModule.applyBoardBackground(type);
    window.showToast(`🖼️ الخلفية: ${window.BoardModule.BOARD_BACKGROUNDS[type].name}`);
};

function savePlayerData() { playerData.customization = { ...currentCustom }; window.SafeStorage.setItem('monsterChessData', JSON.stringify(playerData)); }
window.resetCustomization = function() { currentCustom = { ...DEFAULT_CUSTOM }; if(gameInitialized) window.BoardModule.applyCustomization(currentCustom); savePlayerData(); window.showToast('↺ استعادة الافتراضي'); };
window.setCamera = function(p) { if(gameInitialized) window.BoardModule.setCamera(p); };

window.startPreview = async function() {
    AudioEngine.sfxClick(); document.getElementById('menuScreen').style.display = 'none'; document.getElementById('gameScreen').classList.add('active');
    gameStarted = false;
    if(!gameInitialized) await initGame3D();
    window.BoardModule.draw(chess);
    setTimeout(() => window.BoardModule.onResize(), 300);
    setTimeout(() => openModal('customization'), 150);
};

setTimeout(() => { const s = document.getElementById("splash"); if(s) s.classList.add("hide"); }, 3600);
</script>
</body>
</html>
