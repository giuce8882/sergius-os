import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Sparkles, Send, Loader2, ShieldCheck, Save, History, FileJson } from 'lucide-react';
import Groq from 'groq-sdk';

const SYSTEM_PROMPT = "You are Jarvis, a proactive assistant inside an ADHD Pomodoro Todo app. You can use tools to create folders, search files, and implement plans. When the user says 'Implement this', use the 'implement_plan' tool to bulk-create the tasks on their timeline! Format nicely with markdown.";

const tools = [
    {
        type: 'function',
        function: {
            name: 'create_folder',
            description: "Creates a new folder in the user's local directory for organizing project files.",
            parameters: { type: 'object', properties: { folderName: { type: 'string' } }, required: ['folderName'] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_local_files',
            description: "Searches the user's local directory for files matching a query.",
            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'implement_plan',
            description: "Takes a brainstormed plan and injects it as real tasks into the user's Todo app timeline. Use this when the user says 'Implement this' or asks to save the plan.",
            parameters: {
                type: 'object',
                properties: {
                    tasks: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                text: { type: 'string', description: "The task description. Include 'ora XX' if it needs to be scheduled." },
                                projectId: { type: 'string', description: "The short Project Name (e.g. 'Healing Trail') to group tasks." },
                                energy: { type: 'string', description: "'high', 'low', or null" }
                            },
                            required: ['text', 'projectId']
                        }
                    }
                },
                required: ['tasks']
            }
        }
    }
];

const getGroq = () => new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });

const BrainstormChat = ({ isOpen, onClose, taskTarget, todos, setTodos, extractProjectIdAsync, activeProjectId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [isHistoryView, setIsHistoryView] = useState(false);
    const [savedLogs, setSavedLogs] = useState([]);

    const [pendingArtifact, setPendingArtifact] = useState(null);
    const chatSessionRef = useRef(null);

    const messagesEndRef = useRef(null);
    const [knowledgeBase, setKnowledgeBase] = useState(() => {
        return localStorage.getItem('jarvis_kb') || '';
    });

    useEffect(() => {
        localStorage.setItem('jarvis_kb', knowledgeBase);
    }, [knowledgeBase]);

    useEffect(() => {
        if (!isOpen) {
            setIsHistoryView(false);
        } else {
            if (activeProjectId) fetchLogs();
            if (messages.length === 0 && !isHistoryView) {
                if (taskTarget) {
                    setMessages([{ role: 'ai', content: `Hi! Let's brainstorm: "${taskTarget}". How do you want to start?` }]);
                } else {
                    setMessages([{ role: 'ai', content: "Hi! I'm your AI assistant. Tell me what you're working on and we'll break it down." }]);
                }
            }
        }
    }, [isOpen, taskTarget, activeProjectId]);

    const fetchLogs = async () => {
        if (!activeProjectId) return;
        try {
            await fetch('/api/fs/archive-logs', { method: 'POST', body: JSON.stringify({ projectId: activeProjectId }) });
            const res = await fetch(`/api/fs/load-chat-logs?projectId=${activeProjectId}`);
            const data = await res.json();
            if (data.logs) setSavedLogs(data.logs);
        } catch (e) { console.error("Failed to load logs", e); }
    };

    const handleSaveSession = async () => {
        if (!activeProjectId || messages.length <= 1) return;
        setPendingArtifact({
            id: 'save_session',
            name: 'save_chat_log',
            description: `Saving this Brainstorm session (${messages.length} messages) as a JSON file to the ${activeProjectId} Project Capsule.`,
            args: { projectId: activeProjectId, logData: messages }
        });
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setIsLoading(true);

        try {
            const activeTodos = todos?.filter(t => !t.completed).map(t => t.text) || [];
            const contextStr = activeTodos.length > 0
                ? `\n\nContext - User's active tasks:\n${activeTodos.map(t => `- ${t}`).join('\n')}`
                : `\n\nContext - User currently has no active tasks.`;
            const kbContext = knowledgeBase ? `\n\nJarvis Persistent Memory:\n${knowledgeBase}` : '';
            const promptText = `User says: ${userMessage}${taskTarget ? `\nFocused Task: ${taskTarget}` : ''}${contextStr}${kbContext}\n\nINSTRUCTION: If the user shares a fact you should remember forever (likes, schedules, project context), output a markdown block EXACTLY like this (and nothing else for the memory part):\n\`\`\`json\n{"action": "save_memory", "fact": "..."}\n\`\`\``;

            const historyMessages = messages.slice(1).map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: m.content
            }));

            const allMessages = [...historyMessages, { role: 'user', content: promptText }];

            const groq = getGroq();
            const response = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...allMessages],
                tools,
                max_tokens: 1024
            });

            const choice = response.choices[0];

            if (choice.message.tool_calls?.length > 0) {
                const toolCall = choice.message.tool_calls[0];
                setPendingArtifact({
                    id: toolCall.id,
                    name: toolCall.function.name,
                    args: JSON.parse(toolCall.function.arguments)
                });
                chatSessionRef.current = { messages: allMessages, assistantMessage: choice.message };
                setIsLoading(false);
                return;
            }

            processTextResponse(choice.message.content || '');

        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { role: 'ai', content: `API Error: ${error?.message}` }]);
            setIsLoading(false);
        }
    };

    const handleApproveArtifact = async () => {
        const call = pendingArtifact;
        setPendingArtifact(null);
        setIsLoading(true);

        let apiResult = {};
        try {
            if (call.name === 'create_folder') {
                const res = await fetch('/api/fs/create-folder', { method: 'POST', body: JSON.stringify(call.args) });
                apiResult = await res.json();
            } else if (call.name === 'search_local_files') {
                const res = await fetch('/api/fs/search', { method: 'POST', body: JSON.stringify(call.args) });
                apiResult = await res.json();
            } else if (call.name === 'implement_plan') {
                const newTasks = call.args.tasks.map((taskSpec, index) => {
                    const newId = Date.now() + index;
                    extractProjectIdAsync(newId, taskSpec.text);
                    return {
                        id: newId,
                        text: taskSpec.text,
                        completed: false,
                        stage: 'Idea',
                        energy: taskSpec.energy || null,
                        projectId: taskSpec.projectId,
                        projectColor: null
                    };
                });
                setTodos(prev => [...newTasks, ...prev]);
                apiResult = { success: true, message: `Injected ${newTasks.length} tasks into the timeline.` };
            } else if (call.name === 'save_chat_log') {
                const res = await fetch('/api/fs/save-chat-log', { method: 'POST', body: JSON.stringify(call.args) });
                apiResult = await res.json();
                await fetchLogs();
                setMessages(prev => [...prev, { role: 'ai', content: "✅ **Session Saved successfully to Capsule Vault!**" }]);
                setIsLoading(false);
                return;
            }
        } catch (e) {
            apiResult = { error: e.message };
        }

        try {
            const { messages: prevMessages, assistantMessage } = chatSessionRef.current;
            const followUpMessages = [
                ...prevMessages,
                assistantMessage,
                { role: 'tool', tool_call_id: call.id, content: JSON.stringify(apiResult) }
            ];

            const groq = getGroq();
            const response = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...followUpMessages],
                tools,
                max_tokens: 1024
            });

            processTextResponse(response.choices[0].message.content || '');
        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', content: `Skill Execution Error: ${error?.message}` }]);
            setIsLoading(false);
        }
    };

    const handleDenyArtifact = async () => {
        const call = pendingArtifact;
        setPendingArtifact(null);

        if (call.name === 'save_chat_log') return;

        setIsLoading(true);
        try {
            const { messages: prevMessages, assistantMessage } = chatSessionRef.current;
            const followUpMessages = [
                ...prevMessages,
                assistantMessage,
                { role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: "User denied permission to execute this skill." }) }
            ];

            const groq = getGroq();
            const response = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...followUpMessages],
                tools,
                max_tokens: 1024
            });

            processTextResponse(response.choices[0].message.content || '');
        } catch (e) {
            setIsLoading(false);
        }
    };

    const processTextResponse = (outputText) => {
        let finalOutput = outputText;
        const memoryMatch = outputText.match(/```json\n?(\s*\{\s*"action"\s*:\s*"save_memory".*?\}\s*)\n?```/is);
        if (memoryMatch) {
            try {
                const parsed = JSON.parse(memoryMatch[1]);
                if (parsed.fact) setKnowledgeBase(prev => prev ? prev + '\n- ' + parsed.fact : '- ' + parsed.fact);
            } catch (e) { }
            finalOutput = outputText.replace(memoryMatch[0], '').trim();
        }
        setMessages(prev => [...prev, { role: 'ai', content: finalOutput }]);
        setIsLoading(false);
    };

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-500 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            <div
                className={`fixed top-0 right-0 bottom-0 w-full md:w-[400px] glass-panel !rounded-none !rounded-l-3xl z-[110] transition-transform duration-500 flex flex-col shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
            >
                <div className="flex items-center justify-between p-6 border-b border-white/10 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                            {isHistoryView ? <History size={24} /> : <Bot size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">{isHistoryView ? 'Project History' : 'Brainstorm'}</h2>
                            <p className="text-sm text-white/50 w-48 truncate">{activeProjectId ? `Project: ${activeProjectId}` : taskTarget ? `Focus: ${taskTarget}` : 'AI Assistant'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {activeProjectId && !isHistoryView && (
                            <button onClick={() => { fetchLogs(); setIsHistoryView(true); }} className="p-2 text-purple-300/70 hover:text-purple-300 hover:bg-purple-500/20 rounded-xl transition-colors" title="View Saved Brainstorms">
                                <History size={20} />
                            </button>
                        )}
                        {isHistoryView && (
                            <button onClick={() => setIsHistoryView(false)} className="p-2 text-white/50 hover:text-white/90 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium px-3 flex items-center gap-2">
                                Back to Chat
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {isHistoryView ? (
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {savedLogs.length === 0 ? (
                            <div className="text-center py-10 text-white/40">
                                <FileJson size={32} className="mx-auto mb-3 opacity-50" />
                                <p>No saved brainstorms for this project yet.</p>
                            </div>
                        ) : (
                            savedLogs.map((log, idx) => (
                                <div key={idx} className="bg-black/20 border border-white/5 rounded-2xl p-4 hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => {
                                    alert("Previewing " + log.filename + " (Read-only format to be built)... Total messages: " + log.data.length);
                                }}>
                                    <h3 className="text-white/80 font-medium flex items-center gap-2"><FileJson size={16} className="text-purple-400" /> {log.filename}</h3>
                                    <p className="text-xs text-white/50 mt-1">Contains {log.data.length} messages.</p>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-blue-500/30 border border-blue-400/20 rounded-tr-sm backdrop-blur-md' : 'bg-white/5 border border-white/10 rounded-tl-sm backdrop-blur-md'}`}>
                                        {msg.role === 'ai' && <Sparkles className="inline-block text-purple-300 mb-2 mr-2" size={16} />}
                                        <div className="text-white/90 leading-relaxed text-sm whitespace-pre-wrap">{msg.content}</div>
                                    </div>
                                </div>
                            ))}

                            {pendingArtifact && (
                                <div className="flex justify-start">
                                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl rounded-tl-sm p-4 backdrop-blur-md max-w-[90%]">
                                        <div className="flex items-center gap-2 text-orange-400 mb-2 font-semibold">
                                            <ShieldCheck size={18} />
                                            Review-Driven Artifact
                                        </div>
                                        <p className="text-white/80 text-sm mb-3">
                                            Jarvis wants to execute <code className="block mt-1 bg-black/30 p-1 rounded font-mono text-xs">{pendingArtifact.name}({JSON.stringify(pendingArtifact.args)})</code>
                                        </p>
                                        <div className="flex gap-2">
                                            <button onClick={handleApproveArtifact} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-lg text-sm font-medium transition-colors">Approve</button>
                                            <button onClick={handleDenyArtifact} className="flex-1 bg-white/10 hover:bg-white/20 text-white/80 py-1.5 rounded-lg text-sm font-medium transition-colors">Deny</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4 backdrop-blur-md">
                                        <Loader2 className="animate-spin text-purple-300" size={20} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/40 relative shrink-0 z-20">
                            {activeProjectId && messages.length > 2 && (
                                <div className="mb-3 flex justify-end">
                                    <button onClick={handleSaveSession} disabled={isLoading} className="flex items-center gap-2 px-3 py-1.5 bg-black/30 hover:bg-black/50 border border-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors cursor-pointer">
                                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Project Session
                                    </button>
                                </div>
                            )}
                            <form onSubmit={handleSend} className="relative flex items-center">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask me anything..."
                                    disabled={!!isLoading || !!pendingArtifact}
                                    className="glass-input w-full pr-12 focus:ring-purple-400 focus:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed bg-black/80 shadow-inner block"
                                    style={{ pointerEvents: 'auto' }}
                                />
                                <button
                                    type="submit"
                                    disabled={!!isLoading || !input.trim() || !!pendingArtifact}
                                    className="absolute right-2 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                    style={{ pointerEvents: 'auto' }}
                                >
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default BrainstormChat;
