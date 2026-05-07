import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { generateText } from '../utils/ai';

const VoiceOrb = ({ onIntentParsed, activeProjectId }) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');

    const handleOrbClick = () => {
        if (isListening) return;

        if (!('webkitSpeechRecognition' in window)) {
            alert("Your browser does not support the Web Speech API. Please try Chrome or Edge.");
            return;
        }

        const SpeechRecognition = window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        // Adapt to local testing if needed, but defaults to browser language
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            setTranscript('');
        };

        recognition.onresult = async (event) => {
            const text = event.results[0][0].transcript;
            setTranscript(text);
            setIsListening(false);
            await processIntent(text);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            setIsProcessing(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const processIntent = async (text) => {
        setIsProcessing(true);
        try {
            const prompt = `You are Jarvis, formatting user voice intents into JSON commands for a Todo app.
The user will speak a task. You must output ONLY valid JSON.
Format:
{
  "action": "add_task",
  "text": "The exact task text, formatted nicely. If it mentions a time or hour (e.g. tomorrow at 9), convert it to 'ora X' format (e.g. ora 9) to work with the app's timeline."
}${activeProjectId ? `\n\nCRITICAL CONTEXT: The user is currently inside the [${activeProjectId}] dashboard. Assume this voice task belongs to it and explicitly include it in the text or metadata if possible.` : ''}

User voice input: "${text}"`;

            const responseText = await generateText(prompt, true);

            const match = responseText.match(/\{.*\}/s);
            if (match) {
                const intent = JSON.parse(match[0]);
                if (intent.action === 'add_task' && intent.text) {
                    onIntentParsed(intent.text);
                }
            }
        } catch (e) {
            console.error("Voice processing error", e);
        } finally {
            setIsProcessing(false);
            setTimeout(() => setTranscript(''), 3000); // Clear tooltip after 3s
        }
    };

    return (
        <div className="fixed bottom-24 right-4 md:left-2 md:bottom-2 z-50 flex flex-col items-center">

            {/* Tooltip for transcription */}
            {transcript && (
                <div className="mb-4 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-2xl shadow-lg max-w-[250px] text-center text-sm animate-fade-in-up">
                    "{transcript}"
                </div>
            )}

            {/* The Orb */}
            <button
                onClick={handleOrbClick}
                disabled={isProcessing || isListening}
                className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]
          ${isListening ? 'bg-blue-500/40 scale-110 shadow-[0_0_50px_rgba(59,130,246,0.5)] border-blue-400/50'
                        : isProcessing ? 'bg-purple-500/40 scale-100 border-purple-400/50'
                            : 'bg-white/10 hover:bg-white/20 hover:scale-105 border-white/20'} 
          border backdrop-blur-xl group`}
            >
                {/* Pulsing rings when listening */}
                {isListening && (
                    <>
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-75" />
                        <div className="absolute inset-[-10px] bg-blue-500/10 rounded-full animate-ping opacity-50 animation-delay-300" />
                    </>
                )}

                {isProcessing ? (
                    <Loader2 className="animate-spin text-purple-300" size={28} />
                ) : isListening ? (
                    <Mic className="text-blue-300 drop-shadow-md" size={28} />
                ) : (
                    <MicOff className="text-white/50 group-hover:text-white/80 transition-colors" size={24} />
                )}
            </button>
        </div>
    );
};

export default VoiceOrb;
