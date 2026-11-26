// Reduce the entire microphone signal to one mean-square value per quarter second.
class InsoneaMeter extends AudioWorkletProcessor {
    constructor() {
        super();
        this.energy = 0;
        this.frames = 0;
        this.windowFrames = Math.round(sampleRate / 4);
    }
    process(inputs) {
        const channel = inputs[0][0];
        if (!channel) return true;
        for (const sample of channel) {
            this.energy += sample * sample;
            if (++this.frames === this.windowFrames) {
                this.port.postMessage([this.energy / this.frames, this.frames / sampleRate]);
                this.energy = 0;
                this.frames = 0;
            }
        }
        return true;
    }
}
registerProcessor('insonea-meter', InsoneaMeter);