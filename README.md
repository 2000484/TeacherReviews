# Schoology - Private Web Browser

A secure, fast, and feature-rich web browser with privacy-first design. Access any website privately with built-in proxying, tab management, and browser cloaking features.

## ✨ Features

- **Private Browsing**: Browse the web without leaving traces or exposing your activity
- **Multi-Tab Support**: Open multiple tabs with independent browsing sessions
- **Tab Management**: Drag-and-drop tab reordering, close tabs, duplicate tabs, and more
- **Keyboard Shortcuts**: Full keyboard navigation (Ctrl+T, Ctrl+W, Ctrl+L, etc.)
- **Website Cloaking**: Change the page title and favicon to disguise your browsing activity
- **About:blank Cloaking**: Open in a blank page for maximum discretion
- **Fullscreen Mode**: Hide the address bar and controls
- **Quick Access**: One-click access to popular websites
- **History Management**: Optional browsing history with smart search
- **Multiple Search Engines**: Google, DuckDuckGo, Brave, Startpage, or custom
- **Search Suggestions**: Real-time search and URL suggestions
- **Bookmark System**: Save and organize your favorite sites
- **Lightweight**: Fast loading and efficient resource usage

## 🚀 Quick Start

> **New to this project?** Check out [GETTING_STARTED.md](GETTING_STARTED.md) for a quick guide on setting up your development environment!

### Requirements

- Node.js 16+ (18+ recommended)
- npm 7+ or pnpm 10+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/schoology.git
cd schoology

# Install dependencies
pnpm install

# Start the server
pnpm start
```

The application will be available at `http://localhost:3000`

## 📋 Development

### Scripts

```bash
# Start the development server
pnpm start

# Format code with Prettier
pnpm format

# Run ESLint
pnpm lint

# Fix linting issues
pnpm lint:fix
```

### Directory Structure

```
├── src/
│   └── index.js          # Server entry point
├── public/
│   ├── index.html        # Main UI
│   ├── index.js          # Browser client logic
│   ├── index.css         # Styles
│   ├── search.js         # Search utilities
│   └── sw.js             # Service worker
├── package.json          # Project metadata
└── README.md             # This file
```

## 🔒 Security & Privacy

- **No server-side logging** of user browsing activity
- **Encrypted connections** using HTTPS/WSS
- **Service worker** for offline functionality
- **CORS headers** properly configured
- **Security headers** including CSP, X-Frame-Options, and more
- **No tracking** or analytics

### Security Features

- Cross-Origin Opener Policy
- Cross-Origin Embedder Policy
- Content Security Policy
- Referrer Policy
- X-Frame-Options
- X-Content-Type-Options
- Permissions Policy (camera, microphone, geolocation disabled)

## 🎮 Keyboard Shortcuts

| Shortcut         | Action            |
| ---------------- | ----------------- |
| `Ctrl+T`         | New tab           |
| `Ctrl+W`         | Close current tab |
| `Ctrl+L`         | Focus address bar |
| `Ctrl+R`         | Reload page       |
| `Ctrl+Tab`       | Next tab          |
| `Ctrl+Shift+Tab` | Previous tab      |
| `Ctrl+1-9`       | Jump to tab 1-9   |
| `Ctrl+Shift+T`   | Reopen closed tab |
| `Ctrl+/`         | Show shortcuts    |
| `F11`            | Fullscreen        |

## 📱 Supported Websites

Works best with major sites including:

- Google
- YouTube
- Discord
- Reddit
- Twitter/X
- Instagram
- Spotify
- GitHub
- And thousands more

_Note: Some sites may require specific configurations or may have limitations_

## ⚙️ Configuration

### Environment Variables

None required for basic usage. Configuration is stored in browser localStorage.

### Settings

Access settings through the ⚙️ button in the browser:

- **Search Engine**: Choose your default search engine
- **Auto HTTPS**: Automatically upgrade HTTP to HTTPS
- **Remember History**: Keep track of visited sites
- **Tab Cloaking**: Change page title and favicon
- **Transport Status**: View proxy connection status

## 🚀 Deployment

### Docker

```bash
docker build -t schoology .
docker run -p 3000:3000 schoology
```

### Self-Hosting

See [Titanium Network Guides](https://docs.titaniumnetwork.org/):

- [VPS Hosting](https://docs.titaniumnetwork.org/guides/vps-hosting/)
- [DNS Setup](https://docs.titaniumnetwork.org/guides/dns-setup/)
- [Nginx Reverse Proxy](https://docs.titaniumnetwork.org/guides/nginx/)

### Production Recommendations

- Use HTTPS with valid SSL certificate
- Configure reverse proxy (Nginx, Apache)
- Set up DNS records properly
- Monitor server resources
- Use multiple IPs for CAPTCHAs
- Consider IP rotation for heavy usage

## 🔧 Troubleshooting

### "Pop-up blocked" Error

Allow pop-ups for the domain in your browser settings.

### Sites not loading

- Try disabling "Auto HTTPS"
- Check if the site requires specific handling
- Verify your internet connection
- Check server logs for errors

### Service Worker Issues

- Clear browser cache: Ctrl+Shift+Delete
- Unregister service worker: DevTools → Application → Service Workers
- Restart the server

### Performance Issues

- Close unnecessary tabs
- Check available RAM
- Verify network speed
- Review server resources

## 📝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the GNU Affero General Public License v3 (AGPL-3.0).
See LICENSE file for details.

## 🙏 Credits

Built with:

- [Scramjet Framework](https://github.com/MercuryWorkshop/scramjet) - Underlying web proxy framework
- [Bare Mux](https://github.com/MercuryWorkshop/bare-mux) - Protocol handler
- [Wisp](https://github.com/MercuryWorkshop/wisp-server-python) - WebSocket proxy
- [Fastify](https://www.fastify.io/) - HTTP framework
- [Mercury Workshop](https://github.com/MercuryWorkshop) - Open source community

## ⚠️ Disclaimer

This tool is provided for educational purposes. Users are responsible for their own usage and must comply with applicable laws and policies. The developers assume no liability for misuse.

## 📧 Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

---

**Schoology v1.0.0** • [License](LICENSE) • © 2024-2026
