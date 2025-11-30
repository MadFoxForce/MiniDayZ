// Game modifications for MiniDayZ
// This script modifies game behavior after runtime loads

(function() {
    'use strict';
    
    var modificationsApplied = false;
    var runtime = null;
    
    // Wait for runtime to be ready
    function waitForRuntime() {
        if (typeof window.cr_getC2Runtime === 'function') {
            runtime = window.cr_getC2Runtime();
            if (runtime && !modificationsApplied) {
                modificationsApplied = true;
                setTimeout(applyModifications, 1000);
            }
        } else {
            setTimeout(waitForRuntime, 100);
        }
    }
    
    waitForRuntime();
    
    function applyModifications() {
        try {
            console.log('[Game Modifications] Applying modifications...');
            
            // 1. Force keyboard/mouse controls only (remove tap/stick options)
            forceKeyboardMouseControls();
            
            // 2. Disable automatic melee attack - make it click-to-attack
            setupClickToAttack();
            
            // 3. Change shooting to manual click-to-shoot
            setupClickToShoot();
            
            console.log('[Game Modifications] Modifications applied');
        } catch (e) {
            console.error('[Game Modifications] Error applying modifications:', e);
        }
    }
    
    // Force keyboard/mouse controls only
    function forceKeyboardMouseControls() {
        // Override localStorage to always use keyboard controls
        try {
            var originalSetItem = localStorage.setItem;
            localStorage.setItem = function(key, value) {
                // Block control mode changes
                if (key && (key.indexOf('control') !== -1 || key.indexOf('movement') !== -1 || key.indexOf('mode') !== -1)) {
                    console.log('[Game Modifications] Blocked control mode change:', key, value);
                    return;
                }
                return originalSetItem.call(this, key, value);
            };
            
            // Force keyboard mode on load
            var controlKeys = ['controlMode', 'movementMode', 'inputMode', 'control_mode', 'movement_mode'];
            controlKeys.forEach(function(key) {
                try {
                    localStorage.removeItem(key);
                } catch (e) {}
            });
        } catch (e) {
            console.warn('[Game Modifications] Could not override localStorage:', e);
        }
        
        // Hide control settings UI elements
        var hideControlUI = function() {
            var allElements = document.querySelectorAll('*');
            for (var i = 0; i < allElements.length; i++) {
                var elem = allElements[i];
                var text = elem.textContent || '';
                if (text.indexOf('Movement: By tap') !== -1 ||
                    text.indexOf('Movement: Stick') !== -1 ||
                    text.indexOf('Move by tapping') !== -1 ||
                    text.indexOf('Movement with the stick') !== -1 ||
                    text.indexOf('Choose the movement controls') !== -1) {
                    elem.style.display = 'none';
                    elem.style.visibility = 'hidden';
                    elem.style.opacity = '0';
                    elem.style.height = '0';
                    elem.style.width = '0';
                }
            }
        };
        
        // Run immediately and periodically
        hideControlUI();
        setInterval(hideControlUI, 1000);
    }
    
    // Setup click-to-attack system
    function setupClickToAttack() {
        var canvas = document.getElementById('c2canvas');
        if (!canvas) {
            setTimeout(setupClickToAttack, 500);
            return;
        }
        
        var attackCooldown = 0;
        var lastAttackTime = 0;
        var ATTACK_COOLDOWN_MS = 300; // Minimum time between attacks
        
        // Track mouse/touch position
        var mouseX = 0, mouseY = 0;
        var isRightClick = false;
        
        canvas.addEventListener('mousemove', function(e) {
            var rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        });
        
        // Right click or middle click for melee attack
        canvas.addEventListener('mousedown', function(e) {
            var rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
            
            // Right click or middle click = melee attack
            if (e.button === 2 || e.button === 1) {
                e.preventDefault();
                isRightClick = true;
                handleMeleeAttack(mouseX, mouseY);
            }
        });
        
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            if (isRightClick) {
                handleMeleeAttack(mouseX, mouseY);
            }
            return false;
        });
        
        // Touch: long press for melee attack
        var touchStartTime = 0;
        var touchStartX = 0, touchStartY = 0;
        
        canvas.addEventListener('touchstart', function(e) {
            if (e.touches.length > 0) {
                var touch = e.touches[0];
                var rect = canvas.getBoundingClientRect();
                touchStartX = touch.clientX - rect.left;
                touchStartY = touch.clientY - rect.top;
                touchStartTime = Date.now();
            }
        });
        
        canvas.addEventListener('touchend', function(e) {
            var touchDuration = Date.now() - touchStartTime;
            // Long press (500ms+) = melee attack
            if (touchDuration > 500) {
                handleMeleeAttack(touchStartX, touchStartY);
            }
        });
        
        function handleMeleeAttack(x, y) {
            var now = Date.now();
            if (now - lastAttackTime < ATTACK_COOLDOWN_MS) {
                return; // Cooldown
            }
            lastAttackTime = now;
            
            try {
                // Find nearest enemy at click position
                var enemy = findNearestEnemyAt(x, y);
                if (enemy) {
                    // Trigger melee attack on that enemy
                    triggerMeleeAttack(enemy);
                }
            } catch (e) {
                console.error('[Game Modifications] Error in melee attack:', e);
            }
        }
        
        function findNearestEnemyAt(x, y) {
            if (!runtime || !runtime.types) return null;
            
            var minDist = Infinity;
            var nearestEnemy = null;
            var attackRange = 100; // Melee attack range in pixels
            
            // Search for enemy types
            for (var typeName in runtime.types) {
                var type = runtime.types[typeName];
                if (type && type.instances) {
                    for (var i = 0; i < type.instances.length; i++) {
                        var inst = type.instances[i];
                        if (inst && inst.x !== undefined && inst.y !== undefined) {
                            // Check if it's an enemy (zombie, bandit, etc.)
                            var isEnemy = typeName.toLowerCase().indexOf('zombie') !== -1 ||
                                         typeName.toLowerCase().indexOf('infected') !== -1 ||
                                         typeName.toLowerCase().indexOf('bandit') !== -1 ||
                                         typeName.toLowerCase().indexOf('enemy') !== -1;
                            
                            if (isEnemy) {
                                var dx = inst.x - x;
                                var dy = inst.y - y;
                                var dist = Math.sqrt(dx * dx + dy * dy);
                                
                                if (dist < attackRange && dist < minDist) {
                                    minDist = dist;
                                    nearestEnemy = inst;
                                }
                            }
                        }
                    }
                }
            }
            
            return nearestEnemy;
        }
        
        function triggerMeleeAttack(enemy) {
            // Try to trigger melee attack event
            try {
                if (runtime && runtime.trigger) {
                    // Trigger melee attack on enemy
                    runtime.trigger('OnMeleeAttack', enemy);
                }
                
                // Also try to find player and trigger attack
                var player = findPlayer();
                if (player) {
                    // Set player angle towards enemy
                    if (enemy.x !== undefined && enemy.y !== undefined) {
                        var angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
                        player.angle = angle;
                    }
                    
                    // Trigger attack action
                    if (runtime && runtime.trigger) {
                        runtime.trigger('OnAttack', player);
                    }
                }
            } catch (e) {
                console.error('[Game Modifications] Error triggering melee attack:', e);
            }
        }
        
        // Disable automatic melee triggers
        if (runtime && runtime.tick) {
            var originalTick = runtime.tick;
            runtime.tick = function(dt) {
                var result = originalTick.call(this, dt);
                
                // Disable automatic melee combat triggers
                try {
                    if (this.types) {
                        for (var typeName in this.types) {
                            var type = this.types[typeName];
                            if (type && type.instances) {
                                for (var i = 0; i < type.instances.length; i++) {
                                    var inst = type.instances[i];
                                    if (inst && inst.behaviors) {
                                        for (var j = 0; j < inst.behaviors.length; j++) {
                                            var beh = inst.behaviors[j];
                                            // Disable auto melee
                                            if (beh && beh.name && 
                                                (beh.name.toLowerCase().indexOf('melee') !== -1 ||
                                                 beh.name.toLowerCase().indexOf('combat') !== -1)) {
                                                // Prevent automatic triggering
                                                if (beh.enabled !== undefined) {
                                                    beh.enabled = false;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Silently fail
                }
                
                return result;
            };
        }
    }
    
    // Setup click-to-shoot system
    function setupClickToShoot() {
        var canvas = document.getElementById('c2canvas');
        if (!canvas) {
            setTimeout(setupClickToShoot, 500);
            return;
        }
        
        var shootCooldown = 0;
        var lastShootTime = 0;
        var mouseX = 0, mouseY = 0;
        
        canvas.addEventListener('mousemove', function(e) {
            var rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        });
        
        // Left click for shooting
        canvas.addEventListener('mousedown', function(e) {
            if (e.button === 0) { // Left click
                var rect = canvas.getBoundingClientRect();
                mouseX = e.clientX - rect.left;
                mouseY = e.clientY - rect.top;
                handleShoot(mouseX, mouseY);
            }
        });
        
        // Touch: tap to shoot
        canvas.addEventListener('touchstart', function(e) {
            if (e.touches.length > 0) {
                var touch = e.touches[0];
                var rect = canvas.getBoundingClientRect();
                mouseX = touch.clientX - rect.left;
                mouseY = touch.clientY - rect.top;
                handleShoot(mouseX, mouseY);
            }
        });
        
        function handleShoot(x, y) {
            var now = Date.now();
            if (now - lastShootTime < 100) { // Small cooldown
                return;
            }
            lastShootTime = now;
            
            try {
                var player = findPlayer();
                if (!player) return;
                
                // Calculate angle to click position
                var angle = Math.atan2(y - player.y, x - player.x);
                
                // Trigger shoot in direction of click
                triggerShootInDirection(player, angle, x, y);
            } catch (e) {
                console.error('[Game Modifications] Error in shoot:', e);
            }
        }
        
        function triggerShootInDirection(player, angle, targetX, targetY) {
            try {
                // Set player/weapon angle
                if (player.angle !== undefined) {
                    player.angle = angle;
                }
                
                // Find weapon behavior and trigger shoot
                if (player.behaviors) {
                    for (var i = 0; i < player.behaviors.length; i++) {
                        var beh = player.behaviors[i];
                        if (beh && (beh.name === 'Turret' || beh.name === 'Weapon' || 
                                   (beh.name && beh.name.toLowerCase().indexOf('weapon') !== -1))) {
                            // Set target position
                            if (beh.currentTarget === undefined || beh.currentTarget === null) {
                                // Create a virtual target at click position
                                beh.currentTarget = {
                                    x: targetX,
                                    y: targetY
                                };
                            } else {
                                beh.currentTarget.x = targetX;
                                beh.currentTarget.y = targetY;
                            }
                            
                            // Set angle
                            if (player.angle !== undefined) {
                                player.angle = angle;
                            }
                            
                            // Trigger shoot
                            if (runtime && runtime.trigger) {
                                runtime.trigger('OnShoot', player);
                            }
                            
                            // Also try direct shoot method
                            if (beh.shoot && typeof beh.shoot === 'function') {
                                beh.shoot();
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[Game Modifications] Error triggering shoot:', e);
            }
        }
        
        // Disable automatic aiming
        if (runtime && runtime.tick) {
            var originalTick = runtime.tick;
            var tickCount = 0;
            
            runtime.tick = function(dt) {
                var result = originalTick.call(this, dt);
                
                // Disable auto-aim every few ticks
                tickCount++;
                if (tickCount % 10 === 0) {
                    try {
                        if (this.types) {
                            for (var typeName in this.types) {
                                var type = this.types[typeName];
                                if (type && type.instances) {
                                    for (var i = 0; i < type.instances.length; i++) {
                                        var inst = type.instances[i];
                                        if (inst && inst.behaviors) {
                                            for (var j = 0; j < inst.behaviors.length; j++) {
                                                var beh = inst.behaviors[j];
                                                if (beh && beh.name === 'Turret') {
                                                    // Disable automatic target acquisition
                                                    if (beh.lookForNearestTarget) {
                                                        beh.lookForNearestTarget = function() {
                                                            // Manual aiming only - do nothing
                                                        };
                                                    }
                                                    // Clear auto target
                                                    if (beh.currentTarget && beh.currentTarget !== null) {
                                                        // Only clear if it's an auto-acquired target
                                                        // (we'll set it manually on click)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Silently fail
                    }
                }
                
                return result;
            };
        }
    }
    
    // Helper function to find player
    function findPlayer() {
        if (!runtime || !runtime.types) return null;
        
        // Try common player type names
        var playerNames = ['Player', 'Survivor', 'Character', 'Hero'];
        for (var i = 0; i < playerNames.length; i++) {
            var type = runtime.types[playerNames[i]];
            if (type && type.instances && type.instances.length > 0) {
                return type.instances[0];
            }
        }
        
        // Fallback: find first instance with weapon behavior
        for (var typeName in runtime.types) {
            var type = runtime.types[typeName];
            if (type && type.instances) {
                for (var j = 0; j < type.instances.length; j++) {
                    var inst = type.instances[j];
                    if (inst && inst.behaviors) {
                        for (var k = 0; k < inst.behaviors.length; k++) {
                            var beh = inst.behaviors[k];
                            if (beh && (beh.name === 'Turret' || beh.name === 'Weapon' ||
                                       (beh.name && beh.name.toLowerCase().indexOf('weapon') !== -1))) {
                                return inst;
                            }
                        }
                    }
                }
            }
        }
        
        return null;
    }
    
})();
