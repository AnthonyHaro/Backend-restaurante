const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 5000;

// Archivos JSON
const USERS_FILE = './users.json';
const DISHES_FILE = './dishes.json';
const CART_FILE = './cart.json';
const ORDERS_FILE = './orders.json';

// Middleware
app.use(cors());
app.use(express.json());

// Carpeta de imágenes
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/* ========== UTILS ========== */

const readJSON = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));


app.get('/', (req, res) => {
    res.send('API de Restaurante en funcionamiento OwO');
});

/* ========== USUARIOS ========== */
app.post('/api/register', (req, res) => {
  const { name, email, address, password, contact, cedula } = req.body; 
  if (!name || !email || !address || !password || !contact || !cedula)
    return res.status(400).json({ message: 'Faltan campos' });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email === email))
    return res.status(400).json({ message: 'El correo ya está registrado' });
  if (users.find(u => u.cedula === cedula))
    return res.status(400).json({ message: 'La cédula ya está registrada' });

  users.push({ name, email, address, password, contact, cedula }); 
  saveJSON(USERS_FILE, users);
  res.status(201).json({ message: 'Usuario registrado con éxito' });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });

  res.json({ message: 'Inicio de sesión exitoso', user });
});

app.post('/api/change-password', (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  const users = readJSON(USERS_FILE);
  const index = users.findIndex(u => u.email === email && u.password === oldPassword);
  if (index === -1) return res.status(401).json({ message: 'Credenciales incorrectas' });

  users[index].password = newPassword;
  saveJSON(USERS_FILE, users);
  res.json({ message: 'Contraseña actualizada correctamente' });
});

app.get('/api/users', (req, res) => {
  const users = readJSON(USERS_FILE).map(({ password, ...u }) => u);
  res.json(users);
});

app.delete('/api/users/:email', (req, res) => {
  const email = decodeURIComponent(req.params.email);
  let users = readJSON(USERS_FILE);
  if (!users.some(u => u.email === email))
    return res.status(404).json({ message: 'Usuario no encontrado' });

  users = users.filter(u => u.email !== email);
  saveJSON(USERS_FILE, users);
  res.json({ message: 'Usuario eliminado con éxito' });
});

app.get('/api/users/:email', (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email === email);
  
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  const { password, ...userData } = user;
  res.json(userData);
});

/* ========== PLATOS ========== */

app.get('/api/dishes', (req, res) => {
  res.json(readJSON(DISHES_FILE));
});

app.post('/api/dishes', upload.single('image'), (req, res) => {
  const { name, price, description, category } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  if (!name || !price || !description || !category || !image)
    return res.status(400).json({ message: 'Faltan campos del plato' });

  const dishes = readJSON(DISHES_FILE);
  const newDish = { id: Date.now(), name, price, description, image, category };
  dishes.push(newDish);
  saveJSON(DISHES_FILE, dishes);
  res.status(201).json({ message: 'Plato añadido con éxito', dish: newDish });
});

app.put('/api/dishes/:id', upload.single('image'), (req, res) => {
  const dishId = parseInt(req.params.id);
  const { name, price, description, category } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  const dishes = readJSON(DISHES_FILE);
  const index = dishes.findIndex(d => d.id === dishId);
  if (index === -1) return res.status(404).json({ message: 'Plato no encontrado' });

  dishes[index] = { ...dishes[index], name, price, description, image: image || dishes[index].image, category };
  saveJSON(DISHES_FILE, dishes);
  res.json({ message: 'Plato actualizado con éxito', dish: dishes[index] });
});

app.delete('/api/dishes/:id', (req, res) => {
  const dishId = parseInt(req.params.id);
  const dishes = readJSON(DISHES_FILE);
  const updated = dishes.filter(d => d.id !== dishId);
  if (updated.length === dishes.length) return res.status(404).json({ message: 'Plato no encontrado' });

  saveJSON(DISHES_FILE, updated);
  res.json({ message: 'Plato eliminado con éxito' });
});

/* ========== CARRITO ========== */

app.get('/api/cart/:email', (req, res) => {
  const cart = readJSON(CART_FILE);
  console.log('Carrito leído:', cart);
  const dishes = readJSON(DISHES_FILE);
  const userCart = cart.find(c => c.email === req.params.email);

  if (!userCart) return res.json([]);

  const enrichedItems = userCart.items.map(item => {
    const dish = dishes.find(d => d.id === item.dishId);
    return dish
      ? { ...dish, quantity: item.quantity }
      : { dishId: item.dishId, quantity: item.quantity };
  });

  res.json(enrichedItems);
});

app.post('/api/cart/:email', (req, res) => {
  console.log('Datos recibidos para agregar al carrito:', req.body);
  const { dishId, name, price, image, description, quantity } = req.body;

  if (!dishId || !name || !price || !image || !description || !quantity) {
    return res.status(400).json({ message: 'Faltan campos en la solicitud' });
  }

  const parsedQuantity = parseInt(quantity, 10);
  if (isNaN(parsedQuantity) || parsedQuantity < 1) {
    return res.status(400).json({ message: 'Cantidad inválida' });
  }

  const cart = readJSON(CART_FILE);
  let userCart = cart.find(c => c.email === req.params.email);
  if (!userCart) {
    userCart = { email: req.params.email, items: [] };
    cart.push(userCart);
  }

  const existingItem = userCart.items.find(i => i.dishId === dishId);
  if (existingItem) {
    existingItem.quantity += parsedQuantity;
  } else {
    userCart.items.push({
      dishId,
      name,
      price,
      image,
      description,
      quantity: parsedQuantity,
    });
  }

  saveJSON(CART_FILE, cart);
  res.status(201).json({ message: 'Producto agregado al carrito' });
});

app.delete('/api/cart/:email', (req, res) => {
  let cart = readJSON(CART_FILE);
  cart = cart.filter(c => c.email !== req.params.email);
  saveJSON(CART_FILE, cart);
  res.json({ message: 'Carrito vaciado' });
});

app.delete('/api/cart/:email/:dishId', (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const dishId = parseInt(req.params.dishId, 10);

  const cart = readJSON(CART_FILE);
  const userCart = cart.find(c => c.email === email);

  if (!userCart) {
    return res.status(404).json({ message: 'Carrito no encontrado' });
  }

  const initialLength = userCart.items.length;
  userCart.items = userCart.items.filter(item => item.dishId !== dishId);

  if (userCart.items.length === initialLength) {
    return res.status(404).json({ message: 'Plato no encontrado en el carrito' });
  }

  saveJSON(CART_FILE, cart);
  res.json({ message: 'Plato eliminado del carrito' });
});


/* ========== PEDIDOS ========== */

app.post('/api/orders', (req, res) => {

  console.log('Datos recibidos para el pedido:', req.body); 

  const { email, items, total, address, contact } = req.body; 
  if (!email || !Array.isArray(items) || !total)
    return res.status(400).json({ message: 'Datos incompletos' });

  const orders = readJSON(ORDERS_FILE);
  const newOrder = {
    id: Date.now(),
    email,
    items,
    total,
    address, 
    contact,
    status: 'Pendiente',
    date: new Date().toISOString(),
  };

  orders.push(newOrder);
  saveJSON(ORDERS_FILE, orders);
  res.status(201).json({ message: 'Pedido registrado', order: newOrder });
});


app.get('/api/orders/:email', (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const userOrders = orders.filter(o => o.email === req.params.email);
  res.json(userOrders);
});

app.get('/api/orders', (req, res) => {
  res.json(readJSON(ORDERS_FILE));
});

app.put('/api/orders/:id/status', (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;
  const orders = readJSON(ORDERS_FILE);
  const order = orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

  order.status = status;
  saveJSON(ORDERS_FILE, orders);
  res.json({ message: 'Estado actualizado', order });
});

/* ========== MANEJO DE ERRORES ========== */

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

/* ========== INICIO ========== */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
