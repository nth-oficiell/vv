const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Chemins des fichiers JSON dans /tmp
const DATA_DIR = '/tmp/data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Créer le dossier /tmp/data si inexistant
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Produits par défaut
const DEFAULT_PRODUCTS = [
    { id: '1', name: 'Nitro Boost Promos 3 mois', price: 3, emoji: '🚀', category: 'nitro', stock: 999, isNew: true },
    { id: '2', name: 'Nitro Boost 1 mois', price: 4, emoji: '⚡', category: 'nitro', stock: 999 },
    { id: '3', name: 'Boost Serveur x14 — 1 mois', price: 3.5, emoji: '💎', category: 'boost', stock: 999 },
    { id: '4', name: 'Boost Serveur x14 — 3 mois', price: 8.5, emoji: '💎', category: 'boost', stock: 999 },
    { id: '5', name: 'Bot Discord Personnalisé', price: 10.5, emoji: '🤖', category: 'bot', stock: 50, onTicket: true },
    { id: '6', name: 'Bot Raid Sans Permissions', price: 7, emoji: '🛡️', category: 'bot', stock: 50 },
    { id: '7', name: 'Membres Online x1000', price: 5.5, emoji: '👥', category: 'membres', stock: 999 },
    { id: '8', name: 'Membres Offline x1000', price: 4.7, emoji: '👤', category: 'membres', stock: 999 },
    { id: '9', name: 'Compte Premium Lifetime', price: 5.3, emoji: '👑', category: 'compte', stock: 30, isNew: true },
    { id: '10', name: 'Backup Serveur Discord', price: 4, emoji: '💾', category: 'serveur', stock: 999 },
    { id: '11', name: 'Panel Bot +300 commandes', price: 5, emoji: '🎛️', category: 'panel', stock: 300 }
];

// Configuration par défaut
const DEFAULT_CONFIG = {
    paypalMe: 'https://www.paypal.me/Karimsix',
    discordInvite: 'https://discord.gg/kzlook'
};

// Admin par défaut
const DEFAULT_USERS = [
    { id: '1', name: 'Admin', email: 'admin@kzlook.com', password: 'admin123', isAdmin: true }
];

// Fonctions de lecture/écriture JSON
function readJSON(file, defaultValue = []) {
    try {
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Erreur lecture ${file}:`, error);
    }
    return defaultValue;
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Erreur écriture ${file}:`, error);
        return false;
    }
}

// Initialiser les fichiers si vides
if (!fs.existsSync(PRODUCTS_FILE) || readJSON(PRODUCTS_FILE).length === 0) {
    writeJSON(PRODUCTS_FILE, DEFAULT_PRODUCTS);
}

if (!fs.existsSync(CONFIG_FILE) || Object.keys(readJSON(CONFIG_FILE, {})).length === 0) {
    writeJSON(CONFIG_FILE, DEFAULT_CONFIG);
}

if (!fs.existsSync(USERS_FILE) || readJSON(USERS_FILE).length === 0) {
    writeJSON(USERS_FILE, DEFAULT_USERS);
}

if (!fs.existsSync(ORDERS_FILE)) {
    writeJSON(ORDERS_FILE, []);
}

// JWT
const JWT_SECRET = process.env.JWT_SECRET || 'kzlook-super-secret-2026';

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

// Router principal
module.exports = async (req, res) => {
    const { method, url } = req;
    const path = url.split('?')[0];

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // ==================== AUTH ====================
        if (path === '/api/auth/register' && method === 'POST') {
            const { name, email, password } = req.body;
            
            const users = readJSON(USERS_FILE);
            
            if (users.find(u => u.email === email)) {
                return res.status(400).json({ error: 'Email déjà utilisé' });
            }

            const newUser = {
                id: Date.now().toString(),
                name,
                email,
                password,
                isAdmin: false
            };

            users.push(newUser);
            writeJSON(USERS_FILE, users);

            const token = generateToken(newUser);
            return res.json({
                token,
                user: { id: newUser.id, name, email, isAdmin: false }
            });
        }

        if (path === '/api/auth/login' && method === 'POST') {
            const { email, password } = req.body;
            
            const users = readJSON(USERS_FILE);
            const user = users.find(u => u.email === email && u.password === password);

            if (!user) {
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            }

            const token = generateToken(user);
            return res.json({
                token,
                user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }
            });
        }

        // ==================== PRODUITS ====================
        if (path === '/api/products' && method === 'GET') {
            const { category } = req.query;
            let products = readJSON(PRODUCTS_FILE);
            
            if (category && category !== 'all') {
                products = products.filter(p => p.category === category);
            }
            
            return res.json({ products });
        }

        // ==================== COMMANDES ====================
        if (path === '/api/orders' && method === 'POST') {
            const token = req.headers.authorization?.split(' ')[1];
            const userData = verifyToken(token);
            
            if (!userData) {
                return res.status(401).json({ error: 'Non autorisé' });
            }

            const { productId, paypalName } = req.body;
            
            const products = readJSON(PRODUCTS_FILE);
            const product = products.find(p => p.id === productId);
            
            if (!product || product.stock <= 0) {
                return res.status(400).json({ error: 'Produit indisponible' });
            }

            const order = {
                id: `ORD_${Date.now()}`,
                userId: userData.id,
                userName: userData.name || userData.email,
                productId: product.id,
                productName: product.name,
                amount: product.price,
                paypalName,
                status: 'pending',
                createdAt: new Date().toISOString()
            };

            const orders = readJSON(ORDERS_FILE);
            orders.push(order);
            writeJSON(ORDERS_FILE, orders);

            // Mettre à jour le stock
            product.stock--;
            writeJSON(PRODUCTS_FILE, products);

            const config = readJSON(CONFIG_FILE, DEFAULT_CONFIG);
            return res.json({
                success: true,
                amount: product.price,
                paypalLink: config.paypalMe
            });
        }

        // ==================== CONFIG ====================
        if (path === '/api/config' && method === 'GET') {
            const config = readJSON(CONFIG_FILE, DEFAULT_CONFIG);
            return res.json(config);
        }

        // ==================== ADMIN AUTH ====================
        if (path === '/api/admin/auth' && method === 'POST') {
            const { password } = req.body;
            
            if (password === 'kzlook2026ontop') {
                // Créer un token admin temporaire
                const adminToken = jwt.sign(
                    { isAdmin: true, temp: true },
                    JWT_SECRET,
                    { expiresIn: '1h' }
                );
                return res.json({ success: true, token: adminToken });
            }
            return res.status(401).json({ success: false });
        }

        // ==================== ROUTES ADMIN PROTÉGÉES ====================
        // Vérification pour toutes les routes admin (sauf /api/admin/auth)
        if (path.startsWith('/api/admin/') && path !== '/api/admin/auth') {
            const authHeader = req.headers.authorization;
            
            if (!authHeader) {
                return res.status(401).json({ error: 'Non autorisé' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);

            if (!decoded) {
                return res.status(401).json({ error: 'Token invalide' });
            }

            // Vérifier si c'est un admin (soit via token utilisateur avec isAdmin, soit token temporaire)
            const users = readJSON(USERS_FILE);
            const user = users.find(u => u.id === decoded.id);
            
            const isAuthorized = (user && user.isAdmin) || decoded.temp;

            if (!isAuthorized) {
                return res.status(401).json({ error: 'Non autorisé' });
            }
        }

        // Routes admin
        if (path === '/api/admin/stats' && method === 'GET') {
            const products = readJSON(PRODUCTS_FILE);
            const orders = readJSON(ORDERS_FILE);
            const users = readJSON(USERS_FILE);

            const totalSales = orders.reduce((sum, o) => sum + o.amount, 0);
            const pendingOrders = orders.filter(o => o.status === 'pending').length;
            const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

            return res.json({
                totalSales,
                pendingOrders,
                totalStock,
                totalUsers: users.length
            });
        }

        if (path === '/api/admin/products' && method === 'GET') {
            const products = readJSON(PRODUCTS_FILE);
            return res.json({ products });
        }

        if (path.startsWith('/api/admin/products/') && method === 'PUT') {
            const id = path.split('/').pop();
            const { price, stock } = req.body;
            
            const products = readJSON(PRODUCTS_FILE);
            const product = products.find(p => p.id === id);
            
            if (product) {
                product.price = parseFloat(price);
                product.stock = parseInt(stock);
                writeJSON(PRODUCTS_FILE, products);
                return res.json({ success: true });
            }
            
            return res.status(404).json({ error: 'Produit non trouvé' });
        }

        if (path === '/api/admin/orders' && method === 'GET') {
            const orders = readJSON(ORDERS_FILE);
            return res.json({ orders: orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
        }

        if (path.startsWith('/api/admin/orders/') && method === 'PUT') {
            const id = path.split('/').pop();
            const { status } = req.body;
            
            const orders = readJSON(ORDERS_FILE);
            const order = orders.find(o => o.id === id);
            
            if (order) {
                order.status = status;
                writeJSON(ORDERS_FILE, orders);
                return res.json({ success: true });
            }
            
            return res.status(404).json({ error: 'Commande non trouvée' });
        }

        if (path.startsWith('/api/admin/orders/') && method === 'DELETE') {
            const id = path.split('/').pop();
            
            let orders = readJSON(ORDERS_FILE);
            orders = orders.filter(o => o.id !== id);
            writeJSON(ORDERS_FILE, orders);
            
            return res.json({ success: true });
        }

        if (path === '/api/admin/users' && method === 'GET') {
            const users = readJSON(USERS_FILE).map(({ password, ...u }) => u);
            return res.json({ users });
        }

        if (path === '/api/admin/config' && method === 'PUT') {
            const { paypalMe, discordInvite } = req.body;
            
            const config = readJSON(CONFIG_FILE, DEFAULT_CONFIG);
            if (paypalMe) config.paypalMe = paypalMe;
            if (discordInvite) config.discordInvite = discordInvite;
            writeJSON(CONFIG_FILE, config);
            
            return res.json({ success: true });
        }

        return res.status(404).json({ error: 'Route non trouvée' });

    } catch (error) {
        console.error('Erreur:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
