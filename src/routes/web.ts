import { Router, Request, Response } from 'express';
import { request } from 'undici';

const webRouter = Router();

// Middleware to check if user is authenticated
const requireAuth = async (req: Request, res: Response, next: Function) => {
  const apiKey = (req.session as any)?.apiKey || req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.redirect('/login');
  }

  // Validate API key by making a test request
  try {
    const response = await request(`http://localhost:${process.env.PORT || 3000}/v1/admin/keys`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.statusCode === 401) {
      return res.redirect('/login?error=invalid');
    }

    // Store API key in session for future requests
    if (req.session) {
      (req.session as any).apiKey = apiKey;
    }
    
    next();
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.redirect('/login?error=invalid');
  }
};

// Middleware to add API key to response for client-side requests
const addApiKeyToResponse = (req: Request, res: Response, next: Function) => {
  if ((req.session as any)?.apiKey) {
    res.locals.apiKey = (req.session as any).apiKey;
  }
  next();
};

// Login page
webRouter.get('/login', (req: Request, res: Response) => {
  const error = req.query.error as string;
  res.render('login', {
    title: 'Login - Minecraft Launcher Admin',
    error: error === 'invalid' ? 'Invalid API key' : error === 'required' ? 'API key required' : null
  });
});

// Handle login
webRouter.post('/login', async (req: Request, res: Response) => {
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.redirect('/login?error=required');
  }

  try {
    // Validate API key
    const response = await request(`http://localhost:${process.env.PORT || 3000}/v1/admin/keys`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.statusCode === 401) {
      return res.redirect('/login?error=invalid');
    }

    // Store API key in session
    if (req.session) {
      (req.session as any).apiKey = apiKey;
    }

    res.redirect('/');
  } catch (error) {
    console.error('Error during login:', error);
    res.redirect('/login?error=invalid');
  }
});

// Logout
webRouter.get('/logout', (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
    });
  }
  res.redirect('/login');
});

// Dashboard home page (requires auth)
webRouter.get('/', requireAuth, addApiKeyToResponse, async (req: Request, res: Response) => {
  try {
    const apiKey = (req.session as any)?.apiKey;
    const apiBase = `http://localhost:${process.env.PORT || 3000}/v1/admin`;
    
    // Get API keys
    let apiKeys: any[] = [];
    try {
      const keysResponse = await request(`${apiBase}/keys`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      const keysData = await keysResponse.body.json() as { keys?: any[] };
      apiKeys = keysData.keys || [];
    } catch (error) {
      console.log('Could not fetch API keys:', error);
    }

    // Get launcher assets
    let launcherAssets: any[] = [];
    try {
      const assetsResponse = await request(`${apiBase}/assets`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      const assetsData = await assetsResponse.body.json() as { assets?: any[] };
      launcherAssets = assetsData.assets || [];
    } catch (error) {
      console.log('Could not fetch launcher assets:', error);
    }

    // Get news articles
    let newsArticles: any[] = [];
    try {
      const newsResponse = await request(`${apiBase}/news`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      const newsData = await newsResponse.body.json() as { news?: any[] };
      newsArticles = newsData.news || [];
    } catch (error) {
      console.log('Could not fetch news articles:', error);
    }

    res.render('dashboard', {
      title: 'Minecraft Launcher Admin',
      apiKeys,
      launcherAssets,
      newsArticles,
      apiKey
    });
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    res.render('dashboard', {
      title: 'Minecraft Launcher Admin',
      apiKeys: [],
      launcherAssets: [],
      newsArticles: [],
      apiKey: (req.session as any)?.apiKey,
      error: 'Failed to load dashboard data'
    });
  }
});

// API Key management page (requires auth)
webRouter.get('/keys', requireAuth, addApiKeyToResponse, (req: Request, res: Response) => {
  res.render('keys', {
    title: 'API Key Management',
    apiKey: (req.session as any)?.apiKey
  });
});

// Launcher assets management page (requires auth)
webRouter.get('/assets', requireAuth, addApiKeyToResponse, (req: Request, res: Response) => {
  res.render('assets', {
    title: 'Launcher Management',
    apiKey: (req.session as any)?.apiKey
  });
});

// Java configuration page (requires auth)
webRouter.get('/java', requireAuth, addApiKeyToResponse, (req: Request, res: Response) => {
  res.render('java', {
    title: 'Java Configuration',
    apiKey: (req.session as any)?.apiKey
  });
});

// News management page (requires auth)
webRouter.get('/news', requireAuth, addApiKeyToResponse, (req: Request, res: Response) => {
  res.render('news', {
    title: 'News Management',
    apiKey: (req.session as any)?.apiKey
  });
});

export default webRouter; 