import React, { useState, useEffect, useRef } from 'react';
import {
  ThemeProvider, CssBaseline, Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  Button, TextField, List, ListItemButton, ListItemText, Avatar, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl,
  InputLabel, Divider, Alert, Tabs, Tab
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LogoutIcon from '@mui/icons-material/Logout';
import { getAppTheme } from './theme/theme';
import RichContentRenderer from './components/RichContentRenderer';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const DRAWER_WIDTH = 260;

export default function App() {
  const [mode, setMode] = useState('dark');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState(0); // 0 = Login, 1 = Register
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState('gpt-4o');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemInstruction, setSystemInstruction] = useState('You are a helpful AI assistant.');

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const theme = getAppTheme(mode);

  const authHeaders = token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };

  const handleUnauthorized = () => {
    // localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setConversations([]);
    setActiveConvId(null);
    setMessages([]);
    setAuthError('Session expired or missing. Please sign in.');
    setAuthOpen(true);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch current user & conversations when token is present
  useEffect(() => {
    if (!token) {
      setAuthOpen(true);
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (res.status === 401) {
          handleUnauthorized();
          return null;
        }
        return res.json();
      })
      .then((me) => {
        if (!me) return;
        setUser(me);
        if (me.settings?.theme) setMode(me.settings.theme);
        if (me.settings?.defaultModel) setModel(me.settings.defaultModel);
        if (me.settings?.systemInstruction) setSystemInstruction(me.settings.systemInstruction);
      })
      .catch(console.error);

    fetch(`${API_URL}/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (res.status === 401) {
          handleUnauthorized();
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(console.error);
  }, [token]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = authTab === 0 ? '/auth/login' : '/auth/register';
    const payload =
      authTab === 0
        ? { email: authForm.email, password: authForm.password }
        : { name: authForm.name, email: authForm.email, password: authForm.password };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      console.log('Authentication successful:', data.token);
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthOpen(false);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err) {
      setAuthError('Unable to reach the backend server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    // localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setConversations([]);
    setActiveConvId(null);
    setMessages([]);
    setAuthOpen(true);
  };

  const createBackendConversation = async (title = 'New Chat') => {
    const res = await fetch(`${API_URL}/conversations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title, model })
    });
    if (res.status === 401) {
      handleUnauthorized();
      return null;
    }
    const conv = await res.json();
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv._id);
    return conv;
  };

  const handleNewChat = async () => {
    if (!token) {
      setAuthOpen(true);
      return;
    }
    await createBackendConversation('New Chat');
    setMessages([]);
  };

  const handleSelectConversation = async (id) => {
    setActiveConvId(id);
    if (!token) return;
    const res = await fetch(`${API_URL}/conversations/${id}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    const data = await res.json();
    if (Array.isArray(data)) setMessages(data);
  };

  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c._id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
    if (token) {
      const res = await fetch(`${API_URL}/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) handleUnauthorized();
    }
  };

  const handleSaveSettings = async () => {
    if (token) {
      const res = await fetch(`${API_URL}/auth/settings`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          theme: mode,
          defaultModel: model,
          systemInstruction
        })
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      const updatedUser = await res.json();
      setUser(updatedUser);
    }
    setSettingsOpen(false);
  };

  const handleSendMessage = async (overridePrompt) => {
    const promptText = (overridePrompt || input).trim();
    if (!promptText || isStreaming) return;

    if (!token) {
      setAuthOpen(true);
      return;
    }

    let convId = activeConvId;
    if (!convId || !/^[a-f\d]{24}$/i.test(String(convId))) {
      const created = await createBackendConversation(promptText.slice(0, 42));
      if (!created?._id) return;
      convId = created._id;
    }

    const userMessage = { _id: `${Date.now()}-u`, role: 'user', content: promptText };
    const assistantPlaceholder = { _id: `${Date.now()}-a`, role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    if (!overridePrompt) setInput('');
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_URL}/conversations/${convId}/stream`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ content: promptText, model }),
        signal: abortControllerRef.current.signal
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = JSON.parse(line.slice(6));
            if (payload.token) {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: m.content + payload.token } : m
                )
              );
            }
            if (payload.done && payload.message) {
              setMessages((prev) =>
                prev.map((m, i) => (i === prev.length - 1 ? payload.message : m))
              );
              if (payload.conversationTitle) {
                setConversations((prev) =>
                  prev.map((c) =>
                    c._id === convId ? { ...c, title: payload.conversationTitle } : c
                  )
                );
              }
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Sidebar Drawer */}
        <Drawer
          variant="persistent"
          open={drawerOpen}
          sx={{
            width: drawerOpen ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column'
            }
          }}
        >
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleNewChat}
              sx={{ justifyContent: 'flex-start', borderColor: 'divider', color: 'text.primary' }}
            >
              New chat
            </Button>
          </Box>

          <List sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
            {conversations.map((conv) => (
              <ListItemButton
                key={conv._id}
                selected={conv._id === activeConvId}
                onClick={() => handleSelectConversation(conv._id)}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemText
                  primary={conv.title}
                  primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                />
                <IconButton size="small" onClick={(e) => handleDeleteConversation(e, conv._id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>

          <Divider />
          <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {user && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ px: 1 }}>
                Signed in as {user.name || user.email}
              </Typography>
            )}
            <Button
              fullWidth
              startIcon={<SettingsIcon />}
              onClick={() => setSettingsOpen(true)}
              sx={{ justifyContent: 'flex-start', color: 'text.primary' }}
            >
              Settings & Theme
            </Button>
            {token ? (
              <Button
                fullWidth
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
              >
                Sign out
              </Button>
            ) : (
              <Button
                fullWidth
                variant="contained"
                onClick={() => setAuthOpen(true)}
              >
                Sign in / Register
              </Button>
            )}
          </Box>
        </Drawer>

        {/* Main Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
                  <MenuIcon />
                </IconButton>
                <Select
                  size="small"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  sx={{ fontWeight: 600, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
                >
                  <MenuItem value="gpt-4o">ChatGPT 4o</MenuItem>
                  <MenuItem value="gpt-4o-mini">ChatGPT 4o-mini</MenuItem>
                  <MenuItem value="o1-preview">OpenAI o1-preview</MenuItem>
                </Select>
              </Box>
              <Chip
                label={mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                size="small"
                onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              />
            </Toolbar>
          </AppBar>

          {/* Messages Feed */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 6 }, py: 3 }}>
            {messages.length === 0 ? (
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
                  <AutoAwesomeIcon fontSize="large" />
                </Avatar>
                <Typography variant="h5" fontWeight={600}>What can I help with?</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 650 }}>
                  {[
                    'Design a REST API schema in Markdown table format',
                    'Write a React custom hook for SSE streaming',
                    'Compare SQL vs NoSQL for chat persistence'
                  ].map((prompt) => (
                    <Chip key={prompt} label={prompt} onClick={() => handleSendMessage(prompt)} clickable variant="outlined" />
                  ))}
                </Box>
              </Box>
            ) : (
              <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {messages.map((msg, idx) => (
                  <Box key={msg._id || idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'user' ? (
                      <Box sx={{ bgcolor: 'background.elevated', px: 2.5, py: 1.5, borderRadius: 4, maxWidth: '75%' }}>
                        <Typography variant="body1">{msg.content}</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', mt: 0.5 }}>
                          <AutoAwesomeIcon fontSize="small" />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <RichContentRenderer content={msg.content} />
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                            <Tooltip title="Copy">
                              <IconButton size="small" onClick={() => navigator.clipboard.writeText(msg.content)}>
                                <ContentCopyIcon fontSize="inherit" />
                              </IconButton>
                            </Tooltip>
                            <IconButton size="small"><ThumbUpOutlinedIcon fontSize="inherit" /></IconButton>
                            <IconButton size="small"><ThumbDownOutlinedIcon fontSize="inherit" /></IconButton>
                            <Tooltip title="Regenerate">
                              <IconButton size="small" onClick={() => handleSendMessage(messages[idx - 1]?.content)}>
                                <RefreshIcon fontSize="inherit" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          {msg.suggestedActions?.length > 0 && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                              {msg.suggestedActions.map((action) => (
                                <Chip key={action} label={action} size="small" onClick={() => handleSendMessage(action)} clickable />
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
                <div ref={messagesEndRef} />
              </Box>
            )}
          </Box>

          {/* Input Composer */}
          <Box sx={{ p: 2, maxWidth: 830, width: '100%', mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', bgcolor: 'background.elevated', borderRadius: 4, px: 2, py: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={6}
                placeholder="Message ChatGPT..."
                variant="standard"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                InputProps={{ disableUnderline: true }}
              />
              {isStreaming ? (
                <IconButton onClick={handleStopStreaming} color="error">
                  <StopIcon />
                </IconButton>
              ) : (
                <IconButton onClick={() => handleSendMessage()} disabled={!input.trim()} color="primary">
                  <SendIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>

        {/* Auth Dialog */}
        <Dialog open={authOpen} onClose={() => token && setAuthOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 0 }}>
            <Tabs value={authTab} onChange={(_, v) => { setAuthTab(v); setAuthError(''); }}>
              <Tab label="Sign In" />
              <Tab label="Register" />
            </Tabs>
          </DialogTitle>
          <Box component="form" onSubmit={handleAuthSubmit}>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              {authError && <Alert severity="error">{authError}</Alert>}
              {authTab === 1 && (
                <TextField
                  label="Name"
                  required
                  fullWidth
                  size="small"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                />
              )}
              <TextField
                label="Email"
                type="email"
                required
                fullWidth
                size="small"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              />
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                size="small"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button type="submit" variant="contained" fullWidth disabled={authLoading}>
                {authLoading ? 'Please wait...' : authTab === 0 ? 'Sign In' : 'Create Account'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Settings</DialogTitle>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Theme</InputLabel>
              <Select value={mode} label="Theme" onChange={(e) => setMode(e.target.value)}>
                <MenuItem value="dark">Dark</MenuItem>
                <MenuItem value="light">Light</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Custom System Instructions"
              multiline
              rows={3}
              fullWidth
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveSettings}>Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
