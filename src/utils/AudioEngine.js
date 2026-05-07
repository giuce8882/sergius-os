// src/utils/AudioEngine.js

class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.isMuted = false;

        // Attempt to load preference from localStorage
        try {
            const saved = localStorage.getItem('liquidtodo_muted');
            if (saved !== null) {
                this.isMuted = JSON.parse(saved);
            }
        } catch (e) { }
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        try {
            localStorage.setItem('liquidtodo_muted', JSON.stringify(this.isMuted));
        } catch (e) { }
        return this.isMuted;
    }

    triggerHaptic(ms = 10) {
        if (this.isMuted) return;
        if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }

    playSoftTap() {
        if (this.isMuted) return;
        this.init();
        this.triggerHaptic(10);

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        // Deep, dull thud frequency
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + 0.05);

        // Very short, abrupt envelope
        gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.05);
    }

    playZenChime() {
        if (this.isMuted) return;
        this.init();
        this.triggerHaptic([30, 50, 30]); // Longer vibration pattern

        // Create complex FM synthesis for a "Bowl" sound
        const masterGain = this.audioCtx.createGain();
        masterGain.connect(this.audioCtx.destination);
        masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.8, this.audioCtx.currentTime + 0.05);
        // Extremely long, natural fade out
        masterGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 3.0);

        // Carrier oscillator (The fundamental tone)
        const carrier = this.audioCtx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(320, this.audioCtx.currentTime); // Roughly E4

        // Modulator for the strike "ping"
        const modulator = this.audioCtx.createOscillator();
        modulator.type = 'triangle';
        modulator.frequency.value = 880;

        const modIndex = this.audioCtx.createGain();
        modIndex.gain.setValueAtTime(400, this.audioCtx.currentTime);
        modIndex.gain.exponentialRampToValueAtTime(10, this.audioCtx.currentTime + 0.3);

        modulator.connect(modIndex);
        modIndex.connect(carrier.frequency);

        carrier.connect(masterGain);

        // Auxiliary low drone to add "body" to the bowl
        const subOsc = this.audioCtx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(160, this.audioCtx.currentTime);
        const subGain = this.audioCtx.createGain();
        subGain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 3.5);
        subOsc.connect(subGain);
        subGain.connect(masterGain);

        modulator.start();
        carrier.start();
        subOsc.start();

        modulator.stop(this.audioCtx.currentTime + 3.5);
        carrier.stop(this.audioCtx.currentTime + 3.5);
        subOsc.stop(this.audioCtx.currentTime + 3.5);
    }

    playSonarPing() {
        if (this.isMuted) return;
        this.init();
        this.triggerHaptic([10, 100, 10]);

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.audioCtx.currentTime); // High pitch

        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 10;

        gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, this.audioCtx.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.5);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 1.5);
    }
}

// Export a singleton instance
const audioEngine = new AudioEngine();
export default audioEngine;
