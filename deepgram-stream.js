// Initialize deepgram_client client
const { createClient } = deepgram;
const deepgram_client = createClient('');

// DOM elements
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const transcriptionOutput = document.getElementById('transcriptionOutput');

let mediaRecorder;
let deepgram_clientConnection;
let audioContext;
let audioStream;

// Initialize audio context and stream
async function initializeAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create audio processing node
        const source = audioContext.createMediaStreamSource(audioStream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1);
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        // Initialize deepgram_client connection
        deepgram_clientConnection = deepgram_client.listen.live({
            model: 'nova-2',
            language: 'en-US',
            smart_format: true,
            interim_results: true,
            endpointing: 300,
        });
        
        // Handle deepgram_client events
        deepgram_clientConnection.on('open', () => {
            console.log('Connection opened');
            
            // Add transcript event handler
            deepgram_clientConnection.on('transcriptReceived', (transcription) => {
                console.log('transcriptReceived', transcription);
                const transcript = transcription.channel.alternatives[0].transcript;
                if (transcript) {
                    transcriptionOutput.textContent = transcript;
                }
            });

            // Process audio data
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                if (deepgram_clientConnection.getReadyState() === 1) {
                    const audioData = convertFloat32ToInt16(inputData);
                    deepgram_clientConnection.send(audioData);
                }
            };
        });
        
        deepgram_clientConnection.on('error', (error) => {
            console.error('deepgram_client error:', error);
        });
        
        return true;
    } catch (error) {
        console.error('Error initializing audio:', error);
        return false;
    }
}

// Convert audio data to the correct format
function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
}

// Start recording
async function startRecording() {
    const success = await initializeAudio();
    if (success) {
        startButton.disabled = true;
        stopButton.disabled = false;
    }
}

// Stop recording
function stopRecording() {
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
    if (deepgram_clientConnection) {
        deepgram_clientConnection.finish();
    }
    startButton.disabled = false;
    stopButton.disabled = true;
}

// Event listeners
startButton.addEventListener('click', startRecording);
stopButton.addEventListener('click', stopRecording); 