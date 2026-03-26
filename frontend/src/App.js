import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { format } from 'date-fns';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline, 
  Box, 
  Container, 
  Paper, 
  Typography, 
  TextField, 
  IconButton, 
  List, 
  ListItem, 
  ListItemButton,
  ListItemText, 
  ListItemAvatar, 
  Avatar, 
  Divider, 
  CircularProgress, 
  Button, 
  Badge, 
  AppBar, 
  Toolbar,
  InputBase,
  alpha,
  styled,
  Tooltip,
  LinearProgress
} from '@mui/material';
import { 
  Search as SearchIcon, 
  PowerSettingsNew as PowerSettingsNewIcon, 
  WhatsApp as WhatsAppIcon, 
  CloudDownload as DownloadIcon, 
  CalendarMonth as CalendarIcon, 
  Refresh as RefreshIcon,
  Chat as ChatIcon,
  Person as PersonIcon,
  Groups as GroupsIcon
} from '@mui/icons-material';

// --- STYLED COMPONENTS ---
const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.1),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.2),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

const MessageBubble = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isMe',
})(({ theme, isMe }) => ({
  maxWidth: '85%',
  padding: theme.spacing(1, 2),
  borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px',
  backgroundColor: isMe ? theme.palette.primary.dark : theme.palette.grey[800],
  alignSelf: isMe ? 'flex-end' : 'flex-start',
  marginBottom: theme.spacing(1),
  position: 'relative',
  color: theme.palette.common.white,
  boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
}));

const AppHeader = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#202c33',
  borderBottom: '1px solid #313d45',
  zIndex: theme.zIndex.drawer + 1,
}));

// --- THEME ---
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00a884',
    },
    background: {
      default: '#111b21',
      paper: '#202c33',
    },
    text: {
      primary: '#e9edef',
      secondary: '#8696a0',
    },
  },
  shape: {
    borderRadius: 8,
  },
});

function App() {
  // --- DYNAMIC API & SOCKET CONFIG ---
  // In production, we use the environment variable. In local dev, we fallback to localhost:5000.
  const backendBase = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');
  const API_URL = `${backendBase}/api`;
  const SOCKET_URL = backendBase;
  
  // --- STATE ---
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing Engine...');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [backupName, setBackupName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportCount, setExportCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const containerRef = useRef(null);
  const selectedChatRef = useRef(null);
  const fetchChatsRef = useRef();

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // --- API CALLS ---
  const fetchChats = React.useCallback(async (isManual = false) => {
    try {
      const dbResponse = await axios.get(`${API_URL}/whatsapp/chats?_=${Date.now()}`);
      const loadedChats = dbResponse.data.data || [];
      setChats(loadedChats);

      if (loadedChats.length > 0) {
        setIsAuthenticated(true);
        setQrCode(null);
      }

      if (isManual) {
        setIsSyncing(true);
        await axios.post(`${API_URL}/whatsapp/sync`).catch(() => {});
        const reloaded = await axios.get(`${API_URL}/whatsapp/chats?_=${Date.now()}`);
        setChats(reloaded.data.data || []);
        setIsSyncing(false);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchChatsRef.current = fetchChats;
    fetchChats();
  }, [fetchChats]);

  // --- SOCKET ---
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'], // Robust fallback logic
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('loading', (data) => {
      setLoadingProgress(data.percent);
      setLoadingMessage(data.message);
    });

    socket.on('qr', (data) => {
      setQrCode(data);
      setIsAuthenticated(false);
    });

    socket.on('ready', () => {
      setIsAuthenticated(true);
      setQrCode(null);
      fetchChats();
    });

    socket.on('authenticated', () => {
      setIsAuthenticated(true);
      setQrCode(null);
    });

    socket.on('syncing', () => setIsSyncing(true));
    socket.on('sync-complete', () => {
      setIsSyncing(false);
      fetchChats();
    });

    socket.on('new-message', (msg) => {
      setChats(prev => {
        const index = prev.findIndex(c => c.id === msg.chatId);
        if (index === -1) return prev;
        const updatedChat = { ...prev[index], timestamp: msg.timestamp, messageCount: (prev[index].messageCount || 0) + 1 };
        const updatedList = [...prev];
        updatedList.splice(index, 1);
        return [updatedChat, ...updatedList];
      });

      if (selectedChatRef.current && selectedChatRef.current.id === msg.chatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => {
          if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }, 100);
      }
    });

    socket.on('export-progress', (data) => setExportCount(data.count));

    return () => socket.close();
  }, [SOCKET_URL, fetchChats]);

  // --- ACTIONS ---
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await axios.post(`${API_URL}/whatsapp/logout`);
      window.location.reload();
    } catch (err) {
      alert('Logout failed');
      setIsLoggingOut(false);
    }
  };

  const selectChat = async (chat) => {
    setMessages([]); // NEW: Clear immediately to prevent ghosting
    setSelectedChat(chat);
    setBackupName(chat.name);
    setLoading(true);
    setHasMore(true);
    try {
      const res = await axios.get(`${API_URL}/whatsapp/chats/${chat.id}/messages?limit=50`);
      setMessages(res.data.data.reverse());
      setLoading(false);
      setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, 100);
    } catch (err) {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestId = messages[0].id;
      const { data } = await axios.get(`${API_URL}/whatsapp/chats/${selectedChat.id}/messages?before=${oldestId}&limit=50`);
      const olderData = data.data.reverse();
      if (olderData.length < 50) setHasMore(false);
      
      const scrollHeightBefore = containerRef.current.scrollHeight;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const uniqOlder = olderData.filter(m => !existingIds.has(m.id));
        return [...uniqOlder, ...prev];
      });

      setTimeout(() => {
        if (containerRef.current) containerRef.current.scrollTop += (containerRef.current.scrollHeight - scrollHeightBefore);
      }, 50);
      setLoadingMore(false);
    } catch (err) {
      setLoadingMore(false);
    }
  };

  const exportMessages = async () => {
    if (!selectedChat || !backupName) return;
    setIsExporting(true);
    setExportCount(0);
    try {
      const res = await axios.post(`${API_URL}/messages/export`, {
        chatId: selectedChat.id,
        chatName: selectedChat.name,
        backupName,
        filters: { searchTerm, filterDate }
      });
      alert(`Export Successful: ${res.data.count} messages synced.`);
    } catch (err) {
      alert('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredChats = useMemo(() => {
    return chats.filter(c => (c.name || '').toLowerCase().includes(chatSearchTerm.toLowerCase()));
  }, [chats, chatSearchTerm]);

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      const matchesSearch = msg.message.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = filterDate ? format(new Date(msg.timestamp), 'yyyy-MM-dd') === filterDate : true;
      return matchesSearch && matchesDate;
    });
  }, [messages, searchTerm, filterDate]);

  // --- RENDER HELPERS ---
  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box 
          sx={{ 
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            bgcolor: '#00a884',
            backgroundImage: 'radial-gradient(circle at 50% 50%, #00a884 0%, #008069 100%)'
          }}
        >
          <Container maxWidth="md">
            <Paper elevation={24} sx={{ p: 6, textAlign: 'center', borderRadius: 4, bgcolor: '#202c33' }}>
              <WhatsAppIcon sx={{ fontSize: 70, color: '#00a884', mb: 2 }} />
              <Typography variant="h4" fontWeight="800" color="#e9edef" gutterBottom>
                Scan QR to Connect WhatsApp
              </Typography>
              <Typography variant="body1" color="#8696a0" sx={{ mb: 4 }}>
                Awaiting connection with your account...
              </Typography>

              <Box sx={{ position: 'relative', display: 'inline-block', p: 3, bgcolor: '#fff', borderRadius: 3, boxShadow: '0 0 40px rgba(0,0,0,0.3)' }}>
                {qrCode ? (
                  <Box component="img" src={qrCode} sx={{ width: 280, height: 280, display: 'block' }} />
                ) : (
                  <Box sx={{ width: 280, height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress size={64} thickness={4} color="primary" sx={{ mb: 3 }} />
                    <Typography color="#000" fontWeight="600">{loadingMessage}</Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ mt: 5, px: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="#8696a0">
                    {!isConnected ? "Connecting to backend..." : (qrCode ? "Awaiting scan..." : loadingMessage)}
                  </Typography>
                  <Typography variant="caption" color="primary.main">{loadingProgress}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={loadingProgress} 
                  sx={{ height: 10, borderRadius: 5, bgcolor: '#3b4a54' }} 
                />
              </Box>
              <Button 
                onClick={handleLogout} 
                disabled={isLoggingOut}
                startIcon={<PowerSettingsNewIcon />} 
                variant="outlined"
                color="error" 
                sx={{ mt: 4, px: 4, fontWeight: '700', borderRadius: '10px' }}
              >
                {isLoggingOut ? "Resetting Engine..." : "Reset WhatsApp Connection"}
              </Button>
            </Paper>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Box sx={{ width: 400, borderRight: '1px solid #313d45', display: 'flex', flexDirection: 'column', bgcolor: '#111b21' }}>
          <AppHeader position="static" elevation={0}>
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}><WhatsAppIcon /></Avatar>
                <Typography variant="h6" fontWeight="700">Analyzer</Typography>
              </Box>
              <Box>
                <Tooltip title="Deep Refresh from WhatsApp">
                  <IconButton onClick={() => fetchChats(true)} sx={{ color: isSyncing ? 'primary.main' : 'inherit' }}>
                    <RefreshIcon sx={{ animation: isSyncing ? 'spin 1.5s linear infinite' : 'none' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Secure Logout">
                  <IconButton onClick={handleLogout} disabled={isLoggingOut} sx={{ color: '#ff5f52' }}>
                    {isLoggingOut ? <CircularProgress size={24} color="error" /> : <PowerSettingsNewIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Toolbar>
            <Box sx={{ p: 2 }}>
              <Search>
                <SearchIconWrapper><SearchIcon size={20} /></SearchIconWrapper>
                <StyledInputBase 
                  placeholder="Search chats…" 
                  value={chatSearchTerm} 
                  onChange={(e) => setChatSearchTerm(e.target.value)} 
                />
              </Search>
            </Box>
          </AppHeader>

          <List sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
            {filteredChats.map((chat) => (
              <React.Fragment key={chat.id}>
                <ListItem disablePadding>
                  <ListItemButton 
                    selected={selectedChat?.id === chat.id}
                    onClick={() => selectChat(chat)}
                    sx={{ 
                      py: 2,
                      borderLeft: selectedChat?.id === chat.id ? '5px solid #00a884' : '5px solid transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: '#202c33' }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#3b4a54', width: 48, height: 48 }}>{chat.isGroup ? <GroupsIcon /> : <PersonIcon />}</Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={chat.name || 'External Chat'} 
                      secondary={chat.isGroup ? "Group Conversation" : "Private Chat"} 
                      primaryTypographyProps={{ fontWeight: 600, noWrap: true, fontSize: '1rem' }}
                      secondaryTypographyProps={{ noWrap: true, color: 'text.secondary' }}
                    />
                    <Box sx={{ textAlign: 'right', minWidth: 60 }}>
                      <Typography variant="caption" color="text.secondary">
                        {chat.timestamp ? format(new Date(chat.timestamp), 'HH:mm') : ''}
                      </Typography>
                      {chat.messageCount > 0 && (
                        <Badge badgeContent={chat.messageCount} color="primary" max={9999} sx={{ mt: 1, '& .MuiBadge-badge': { fontSize: '0.7rem' } }} />
                      )}
                    </Box>
                  </ListItemButton>
                </ListItem>
                <Divider component="li" sx={{ borderColor: '#313d45' }} />
              </React.Fragment>
            ))}
          </List>
        </Box>

        {/* Dashboard Main Panel */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#0b141a' }}>
          {selectedChat ? (
            <>
              <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #313d45', bgcolor: '#202c33' }}>
                <Toolbar sx={{ gap: 2 }}>
                  <Avatar sx={{ bgcolor: '#3b4a54' }}><PersonIcon /></Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">{selectedChat.name}</Typography>
                    <Typography variant="caption" color="text.secondary">Synced: {selectedChat.messageCount || 0}</Typography>
                  </Box>
                  
                  {/* Search within chat UI */}
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Search sx={{ m: 0, bgcolor: 'rgba(0,0,0,0.2)' }}>
                      <SearchIconWrapper><SearchIcon size={18} /></SearchIconWrapper>
                      <StyledInputBase 
                        placeholder="Search messages..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                      />
                    </Search>
                    <Tooltip title="Filter by Date">
                      <TextField 
                        type="date" 
                        size="small" 
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        sx={{ width: 140, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                      />
                    </Tooltip>
                    {filterDate && <IconButton onClick={() => setFilterDate('')} size="small"><CalendarIcon color="error" /></IconButton>}
                  </Box>

                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                  <TextField 
                    size="small" 
                    placeholder="Export Name..." 
                    value={backupName} 
                    onChange={(e) => setBackupName(e.target.value)}
                    sx={{ width: 160 }} 
                  />
                  <Badge badgeContent={exportCount} color="secondary" max={99999}>
                    <Button 
                      variant="contained" 
                      onClick={exportMessages}
                      disabled={isExporting}
                      startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                    >
                      Export
                    </Button>
                  </Badge>
                </Toolbar>
              </AppBar>

              <Box 
                ref={containerRef}
                onScroll={(e) => { if (e.target.scrollTop < 10) loadMoreMessages(); }}
                sx={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  p: 4, 
                  display: 'flex', 
                  flexDirection: 'column',
                  backgroundImage: 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)',
                  backgroundOpacity: 0.1,
                  backgroundAttachment: 'fixed'
                }}
              >
                {loadingMore && <Box sx={{ textAlign: 'center', mb: 2 }}><CircularProgress size={24} /></Box>}
                {loading ? (
                  <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress color="primary" size={60} />
                  </Box>
                ) : (
                  filteredMessages.map((msg, idx) => {
                    const isMe = msg.sender === 'Me';
                    return (
                      <MessageBubble key={msg.id || idx} isMe={isMe}>
                        {!isMe && (
                          <Typography variant="caption" sx={{ fontWeight: '800', color: 'primary.main', mb: 0.5, display: 'block' }}>
                            {msg.sender}
                          </Typography>
                        )}
                        <Typography variant="body1" sx={{ wordBreak: 'break-word', lineHeight: 1.5 }}>
                          {msg.message}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, opacity: 0.7, fontSize: '0.65rem' }}>
                          {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}
                        </Typography>
                      </MessageBubble>
                    );
                  })
                )}
                {filteredMessages.length === 0 && !loading && (
                   <Box sx={{ textAlign: 'center', mt: 10, color: 'text.secondary' }}>No messages found for the current search.</Box>
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#222e35' }}>
              <ChatIcon sx={{ fontSize: 120, color: '#3b4a54', mb: 3 }} />
              <Typography variant="h4" fontWeight="600" color="text.secondary" gutterBottom>Analyze WhatsApp History</Typography>
              <Typography variant="body1" color="text.secondary">
                Select a conversation to begin deep archival and indexing.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Styles for Animations */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
      `}</style>
    </ThemeProvider>
  );
}

export default App;
