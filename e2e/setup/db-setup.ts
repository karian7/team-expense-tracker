import { test as setup } from '@playwright/test';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

setup('setup database', async () => {
  // Reset database to clean state
  try {
    await axios.delete(`${API_URL}/settings/reset`);
  } catch (error) {
    console.log('Database reset error (may not exist yet):', error);
  }
});
