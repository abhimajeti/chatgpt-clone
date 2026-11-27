import { createTheme } from '@mui/material/styles';

export const getAppTheme = (mode = 'dark') =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: {
              default: '#212121',
              paper: '#171717',
              elevated: '#2F2F2F',
              hover: '#2A2B32'
            },
            text: {
              primary: '#ECECEC',
              secondary: '#9B9B9B'
            },
            divider: 'rgba(255, 255, 255, 0.1)',
            primary: { main: '#10A37F' }
          }
        : {
            background: {
              default: '#FFFFFF',
              paper: '#F9F9F9',
              elevated: '#F4F4F4',
              hover: '#ECECEC'
            },
            text: {
              primary: '#0D0D0D',
              secondary: '#676767'
            },
            divider: 'rgba(0, 0, 0, 0.08)',
            primary: { main: '#10A37F' }
          })
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      button: { textTransform: 'none', fontWeight: 500 }
    },
    shape: { borderRadius: 12 }
  });
