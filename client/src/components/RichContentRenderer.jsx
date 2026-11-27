import React, { useState } from 'react';
import { Box, Typography, Paper, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

const CodeBlock = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Paper variant="outlined" sx={{ my: 2, overflow: 'hidden', bgcolor: '#0D0D0D', borderColor: 'rgba(255,255,255,0.12)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 0.75, bgcolor: '#2F2F2F', color: '#B4B4B4' }}>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', textTransform: 'lowercase' }}>
          {language || 'code'}
        </Typography>
        <IconButton size="small" onClick={handleCopy} sx={{ color: '#ECECEC' }}>
          {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Box component="pre" sx={{ p: 2, m: 0, overflowX: 'auto', fontFamily: '"Fira Code", monospace', fontSize: '0.875rem', color: '#E6EDF3' }}>
        <code>{code}</code>
      </Box>
    </Paper>
  );
};

export default function RichContentRenderer({ content }) {
  if (!content) return null;

  // Split by fenced code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <Box sx={{ '& p': { mb: 1.5, lineHeight: 1.7 }, '& p:last-child': { mb: 0 } }}>
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const lang = lines[0].trim();
          const code = lines.slice(1).join('\n');
          return <CodeBlock key={idx} language={lang} code={code} />;
        }

        // Parse Markdown Tables
        const lines = part.trim().split('\n');
        const tableLines = lines.filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
        if (tableLines.length >= 2) {
          const headers = tableLines[0].split('|').filter(Boolean).map(h => h.trim());
          const rows = tableLines.slice(2).map(row => row.split('|').filter(Boolean).map(c => c.trim()));
          return (
            <TableContainer key={idx} component={Paper} variant="outlined" sx={{ my: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    {headers.map((h, i) => (
                      <TableCell key={i} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, rIdx) => (
                    <TableRow key={rIdx}>
                      {r.map((cell, cIdx) => (
                        <TableCell key={cIdx}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          );
        }

        // Render Images ![alt](url)
        const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
        if (imgMatch) {
          return (
            <Box key={idx} sx={{ my: 2 }}>
              <Box component="img" src={imgMatch[2]} alt={imgMatch[1]} sx={{ maxWidth: '100%', borderRadius: 2, boxShadow: 2 }} />
              {imgMatch[1] && <Typography variant="caption" color="text.secondary">{imgMatch[1]}</Typography>}
            </Box>
          );
        }

        // Render standard paragraphs & lists
        return lines.map((line, lIdx) => {
          if (!line.trim()) return null;
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            return (
              <Box key={`${idx}-${lIdx}`} sx={{ display: 'flex', gap: 1.5, pl: 1, mb: 0.75 }}>
                <Typography component="span">•</Typography>
                <Typography variant="body1">{line.trim().slice(2)}</Typography>
              </Box>
            );
          }
          return (
            <Typography key={`${idx}-${lIdx}`} variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {line}
            </Typography>
          );
        });
      })}
    </Box>
  );
}
