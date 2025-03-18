'use client';

import { Container, Box } from '@mui/material';
import CurrentPosition from '@/components/current-position/CurrentPosition';

export default function Home() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <CurrentPosition />
      </Box>
    </Container>
  );
}