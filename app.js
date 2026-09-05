/**
 * MGN Cafe - Smart Tablet POS System (100% Offline Single Page Application)
 * Currency: Indian Rupees (₹)
 * Features:
 * 1. Business & Earnings Analytics Dashboard (Total Revenue, Capital Invested, Net Profit, Inventory Valuation)
 * 2. Investment & Expense Tracker (Log, View, Categorize, Calculate ROI)
 * 3. Inventory Stock Health & Quick Restock
 * 4. Zero-Flash In-Place State Synchronization
 * 5. Card Popup Effects (+1 Floating Particles, Spring Physics), Quick Customizer Modal, Offline Photo Upload.
 */

// ==========================================
// 1. DEFAULT DATA & STORAGE INITIALIZATION (RUPEES ₹)
// ==========================================

const DEFAULT_SETTINGS = {
  storeName: "MGN Cafe",
  storeBranch: "Main Branch · Terminal #01",
  terminal: "Terminal #01",
  cashier: "Cashier",
  shiftStatus: "Active",
  currency: "₹",
  taxRate: 5.0, // 5% GST
  taxMode: "exclusive", // "exclusive" or "inclusive"
  gstin: "07AAAAA0000A1Z5",
  upiId: "mgncafe@okhdfcbank",
  businessEmail: "billing@mgncafe.in",
  receiptHeader: "Welcome to MGN Cafe · Artisan Coffee",
  receiptAddress: "MGN Cafe, Main High Street, City",
  receiptPhone: "+91 98765 43210",
  receiptFooter: "Thank you for visiting MGN Cafe! Please visit us again.",
  drawerFloat: 0.00,
  paperWidth: "80mm",
  showLogoOnReceipt: true,
  showGstinOnReceipt: true,
  showCustomerOnReceipt: true,
  autoRoundOff: false,
  invoicePrefix: "MGN-",
  syncRoomCode: "MGN-CAFE-MAIN"
};

const DEFAULT_CATEGORIES = ["All Items", "Burgers", "Beverages", "Salads", "Sides", "Desserts", "Bakery"];
const DEFAULT_PRODUCTS = [];
const DEFAULT_INVESTMENTS = [];
const DEFAULT_SAMPLE_ORDERS = [];

// ==========================================
// 2. STATE MANAGER & PERSISTENCE
// ==========================================

class POSState {
  constructor() {
    this.loadState();
  }

  loadState() {
    const storedSettings = JSON.parse(localStorage.getItem("mgn_pos_settings"));
    this.settings = { ...DEFAULT_SETTINGS, ...(storedSettings || {}) };
    if (this.settings.currency !== "₹") {
      this.settings.currency = "₹";
      this.saveSettings();
    }

    const storedProducts = JSON.parse(localStorage.getItem("mgn_pos_products"));
    if (storedProducts !== null && Array.isArray(storedProducts)) {
      this.products = storedProducts;
      // Auto-sanitize and repair any legacy duplicate product IDs
      const seenIds = new Set();
      let hasDuplicateIds = false;
      this.products.forEach((p, index) => {
        if (!p.id || seenIds.has(p.id)) {
          p.id = `p-${Date.now()}-${index}-${Math.floor(1000 + Math.random() * 9000)}`;
          hasDuplicateIds = true;
        }
        seenIds.add(p.id);
      });
      if (hasDuplicateIds) {
        this.saveProducts();
      }
    } else {
      this.products = [];
    }

    const storedCategories = JSON.parse(localStorage.getItem("mgn_pos_categories"));
    if (storedCategories !== null && Array.isArray(storedCategories)) {
      this.categories = storedCategories;
    } else {
      this.categories = DEFAULT_CATEGORIES;
    }
    
    const storedOrders = JSON.parse(localStorage.getItem("mgn_pos_orders"));
    if (storedOrders && Array.isArray(storedOrders)) {
      this.orders = storedOrders.filter(o => o.id && !o.id.startsWith("ord-seed"));
      this.saveOrders();
    } else {
      this.orders = [];
    }
    
    const storedInvestments = JSON.parse(localStorage.getItem("mgn_pos_investments"));
    if (storedInvestments && Array.isArray(storedInvestments)) {
      this.investments = storedInvestments.filter(i => i.id && !i.id.startsWith("inv-1") && !i.id.startsWith("inv-2") && !i.id.startsWith("inv-3") && !i.id.startsWith("inv-4") && !i.id.startsWith("inv-5") && !i.id.startsWith("inv-6"));
      this.saveInvestments();
    } else {
      this.investments = [];
    }

    const storedDrawer = JSON.parse(localStorage.getItem("mgn_pos_drawer"));
    if (storedDrawer) {
      this.drawer = storedDrawer;
      // If drawer was at default 2000 with no sales/logs, sync with settings float
      if (this.drawer.startingFloat === 2000.00 && (!this.drawer.logs || this.drawer.logs.length === 0) && (!this.drawer.cashSales || this.drawer.cashSales === 0)) {
        this.drawer.startingFloat = this.settings.drawerFloat || 0.00;
        this.drawer.currentBalance = this.settings.drawerFloat || 0.00;
        this.saveDrawer();
      }
    } else {
      this.drawer = {
        startingFloat: this.settings.drawerFloat || 0.00,
        cashSales: 0.00,
        cashIn: 0.00,
        cashOut: 0.00,
        currentBalance: this.settings.drawerFloat || 0.00,
        logs: []
      };
    }

    // Held Orders Queue (Park & Recall)
    const storedHeldOrders = JSON.parse(localStorage.getItem("mgn_pos_held_orders"));
    this.heldOrders = (storedHeldOrders && Array.isArray(storedHeldOrders)) ? storedHeldOrders : [];

    // Active session cart starts 100% empty
    this.cart = [];

    this.activeCategory = "All Items";
    this.searchQuery = "";
    this.productManagerFilter = "All Items";
    this.productManagerSearch = "";
    this.customer = { name: "Walk-in Customer", phone: "", id: "CUST-01" };
    this.discount = { type: "none", value: 0 };
    this.orderNote = "";
    this.currentRoute = "dashboard";
    this.activeTransaction = null;
    this.calcInput = "0";
  }

  saveSettings() {
    localStorage.setItem("mgn_pos_settings", JSON.stringify(this.settings));
  }

  saveProducts() {
    localStorage.setItem("mgn_pos_products", JSON.stringify(this.products));
  }

  saveCategories() {
    localStorage.setItem("mgn_pos_categories", JSON.stringify(this.categories));
  }

  saveOrders() {
    localStorage.setItem("mgn_pos_orders", JSON.stringify(this.orders));
  }

  saveInvestments() {
    localStorage.setItem("mgn_pos_investments", JSON.stringify(this.investments));
  }

  saveDrawer() {
    localStorage.setItem("mgn_pos_drawer", JSON.stringify(this.drawer));
  }

  saveHeldOrders() {
    localStorage.setItem("mgn_pos_held_orders", JSON.stringify(this.heldOrders));
  }

  // --- BUSINESS ANALYTICS METRICS ---
  getTotalRevenue() {
    return this.orders.reduce((sum, ord) => sum + (ord.total || 0), 0);
  }

  getTotalInvested() {
    return this.investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  }

  getTotalInventoryValue() {
    return this.products.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || (p.price * 0.4))), 0);
  }

  getTotalInventoryRetailValue() {
    return this.products.reduce((sum, p) => sum + ((p.stock || 0) * p.price), 0);
  }

  getEstimatedCOGS() {
    // Cost of Goods Sold from completed orders
    let cogs = 0;
    this.orders.forEach(order => {
      order.items.forEach(item => {
        const prod = this.products.find(p => p.id === item.productId);
        const unitCost = prod ? (prod.costPrice || prod.price * 0.4) : (item.price * 0.4);
        cogs += unitCost * item.qty;
      });
    });
    return cogs;
  }

  getNetGrossProfit() {
    return Math.max(0, this.getTotalRevenue() - this.getEstimatedCOGS());
  }

  // --- INVESTMENTS CRUD ---
  addInvestment(invData) {
    const newInv = {
      id: `inv-${Date.now()}`,
      title: invData.title || "Equipment / Expense",
      category: invData.category || "Equipment",
      amount: parseFloat(invData.amount) || 0.00,
      date: invData.date || new Date().toISOString().slice(0, 10)
    };
    this.investments.unshift(newInv);
    this.saveInvestments();
    if (this.currentRoute === "analytics") {
      renderApp();
    }
    return newInv;
  }

  updateInvestment(invId, invData) {
    const inv = this.investments.find(i => i.id === invId);
    if (inv) {
      inv.title = invData.title || inv.title;
      inv.category = invData.category || inv.category;
      inv.amount = parseFloat(invData.amount) || inv.amount;
      inv.date = invData.date || inv.date;
      this.saveInvestments();
      if (this.currentRoute === "analytics") {
        renderApp();
      }
    }
  }

  deleteInvestment(invId) {
    this.investments = this.investments.filter(i => i.id !== invId);
    this.saveInvestments();
    if (this.currentRoute === "analytics") {
      renderApp();
    }
  }

  restockProduct(productId, addQty) {
    const p = this.products.find(item => item.id === productId);
    if (p) {
      p.stock = (p.stock || 0) + addQty;
      this.saveProducts();
      if (this.currentRoute === "analytics") {
        renderApp();
      }
    }
  }

  // --- PRODUCT MANAGEMENT CRUD & REORDERING (ZERO-FLASH) ---
  reorderProduct(productId, direction) {
    const index = this.products.findIndex(p => p.id === productId);
    if (index === -1) return;
    
    if (direction === 'left' || direction === 'up') {
      if (index > 0) {
        const temp = this.products[index];
        this.products[index] = this.products[index - 1];
        this.products[index - 1] = temp;
        this.saveProducts();
        showToast(`Moved "${temp.name}" left`, "info", "swap_horiz");
      }
    } else if (direction === 'right' || direction === 'down') {
      if (index < this.products.length - 1) {
        const temp = this.products[index];
        this.products[index] = this.products[index + 1];
        this.products[index + 1] = temp;
        this.saveProducts();
        showToast(`Moved "${temp.name}" right`, "info", "swap_horiz");
      }
    }
    
    if (this.currentRoute === "products-manager") {
      updateProductManagerGridDOM();
    } else if (this.currentRoute === "dashboard") {
      updateProductGridDOM();
    }
  }

  moveProductToIndex(fromIndex, toIndex) {
    if (fromIndex >= 0 && fromIndex < this.products.length && toIndex >= 0 && toIndex < this.products.length && fromIndex !== toIndex) {
      const [movedItem] = this.products.splice(fromIndex, 1);
      this.products.splice(toIndex, 0, movedItem);
      this.saveProducts();
      showToast(`Reordered "${movedItem.name}"`, "success", "check");
      
      if (this.currentRoute === "products-manager") {
        updateProductManagerGridDOM();
      } else if (this.currentRoute === "dashboard") {
        updateProductGridDOM();
      }
    }
  }

  addProduct(productData) {
    const newProduct = {
      id: `p-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: productData.name || "Untitled Item",
      category: productData.category || "Beverages",
      price: parseFloat(productData.price) || 0.00,
      costPrice: parseFloat(productData.costPrice) || (parseFloat(productData.price) * 0.4) || 30.00,
      stock: parseInt(productData.stock) || 50,
      sku: productData.sku || `SKU-${Math.floor(100 + Math.random() * 900)}`,
      defaultModifier: productData.defaultModifier || "",
      availableModifiers: productData.availableModifiers || [productData.defaultModifier || "Standard"],
      img: productData.img || "",
      fallbackIcon: productData.fallbackIcon || (productData.isCombo ? "fastfood" : "local_cafe"),
      color: productData.color || (productData.isCombo ? "#ffdcc2" : "#eff4ff"),
      isCombo: Boolean(productData.isCombo),
      comboItems: Array.isArray(productData.comboItems) ? productData.comboItems : [],
      portions: productData.portions || null
    };

    this.products.unshift(newProduct);

    if (!this.categories.includes(newProduct.category)) {
      this.categories.push(newProduct.category);
      this.saveCategories();
    }

    this.saveProducts();
    if (this.currentRoute === "products-manager") {
      updateProductManagerGridDOM();
    } else if (this.currentRoute === "dashboard") {
      updateProductGridDOM();
    }
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("product_add", { type: "PRODUCT_ADD", product: newProduct });
      try { cloudSync.uploadAllData(); } catch(e) {}
    }
    return newProduct;
  }

  updateProduct(productId, updatedData) {
    const index = this.products.findIndex(p => p.id === productId);
    if (index > -1) {
      this.products[index] = {
        ...this.products[index],
        name: updatedData.name,
        category: updatedData.category,
        price: parseFloat(updatedData.price) || 0.00,
        costPrice: parseFloat(updatedData.costPrice) || this.products[index].costPrice || 30.00,
        stock: parseInt(updatedData.stock) !== undefined ? parseInt(updatedData.stock) : this.products[index].stock,
        sku: updatedData.sku,
        defaultModifier: updatedData.defaultModifier,
        img: updatedData.img,
        fallbackIcon: updatedData.fallbackIcon || this.products[index].fallbackIcon,
        color: updatedData.color || this.products[index].color,
        isCombo: Boolean(updatedData.isCombo),
        comboItems: Array.isArray(updatedData.comboItems) ? updatedData.comboItems : [],
        portions: updatedData.portions !== undefined ? updatedData.portions : this.products[index].portions
      };

      if (!this.categories.includes(updatedData.category)) {
        this.categories.push(updatedData.category);
        this.saveCategories();
      }

      this.saveProducts();
      if (this.currentRoute === "products-manager") {
        updateProductManagerGridDOM();
      } else if (this.currentRoute === "dashboard") {
        updateProductGridDOM();
      }
      if (typeof cloudSync !== "undefined") {
        cloudSync.publish("product_update", { type: "PRODUCT_UPDATE", product: this.products[index] });
        try { cloudSync.uploadAllData(); } catch(e) {}
      }
      return this.products[index];
    }
    return null;
  }

  deleteProduct(productId) {
    this.products = this.products.filter(p => p.id !== productId);
    this.saveProducts();
    if (this.currentRoute === "products-manager") {
      updateProductManagerGridDOM();
    } else if (this.currentRoute === "dashboard") {
      updateProductGridDOM();
    }
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("product_delete", { type: "PRODUCT_DELETE", productId });
      try { cloudSync.uploadAllData(); } catch(e) {}
    }
  }

  addCategory(categoryName) {
    const trimmed = categoryName.trim();
    if (trimmed && !this.categories.includes(trimmed)) {
      this.categories.push(trimmed);
      this.saveCategories();
      if (this.currentRoute === "products-manager") {
        updateProductManagerGridDOM();
      } else if (this.currentRoute === "dashboard") {
        renderApp();
      }
      if (typeof cloudSync !== "undefined") {
        cloudSync.publish("category_add", { type: "CATEGORY_ADD", category: trimmed });
      }
    }
  }

  deleteCategory(categoryName, fallbackCategory = "") {
    const trimmed = categoryName.trim();
    if (!trimmed || trimmed === "All Items") return false;

    // Remove category from list
    this.categories = this.categories.filter(c => c !== trimmed);
    if (!fallbackCategory) {
      fallbackCategory = this.categories.find(c => c !== "All Items") || "Beverages";
    }

    // Safely reassign any products that were in this category so they are not orphaned
    let reassignedCount = 0;
    this.products.forEach(p => {
      if (p.category === trimmed) {
        p.category = fallbackCategory;
        reassignedCount++;
      }
    });

    // Reset filters if currently active on deleted category
    if (this.activeCategory === trimmed) {
      this.activeCategory = "All Items";
    }
    if (this.productManagerFilter === trimmed) {
      this.productManagerFilter = "All Items";
    }

    this.saveCategories();
    if (reassignedCount > 0) {
      this.saveProducts();
    }

    if (this.currentRoute === "products-manager") {
      updateProductManagerGridDOM();
    } else if (this.currentRoute === "dashboard") {
      renderApp();
    }

    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("category_delete", { type: "CATEGORY_DELETE", category: trimmed, fallbackCategory });
    }

    return true;
  }

  // --- TARGETED CART OPERATIONS WITH POPUP EFFECTS & COMBO/PORTION SUPPORT ---
  addToCart(product, customModifier = "", cardElement = null, customPrice = null) {
    const modifierToUse = customModifier || product.defaultModifier || "";
    const priceToUse = (typeof customPrice === "number" && !isNaN(customPrice) && customPrice > 0) ? customPrice : product.price;
    const existing = this.cart.find(item => item.productId === product.id && item.modifier === modifierToUse && item.price === priceToUse);
    let targetCartId = null;

    if (existing) {
      existing.qty += 1;
      targetCartId = existing.id;
    } else {
      targetCartId = `cart-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      this.cart.push({
        id: targetCartId,
        productId: product.id,
        name: product.name,
        price: priceToUse,
        qty: 1,
        modifier: modifierToUse,
        sku: product.sku,
        isCombo: Boolean(product.isCombo),
        comboItems: product.comboItems || []
      });
    }

    if (cardElement) {
      triggerCardPopEffect(cardElement);
    } else {
      const el = document.querySelector(`.product-card[data-product-id="${product.id}"]`);
      if (el) triggerCardPopEffect(el);
    }

    if (this.currentRoute === "dashboard") {
      updateCartPanelDOM(targetCartId);
      updateProductBadgeDOM(product.id);
    }
  }

  updateItemQty(cartItemId, delta) {
    const itemIndex = this.cart.findIndex(item => item.id === cartItemId);
    if (itemIndex > -1) {
      const prodId = this.cart[itemIndex].productId;
      this.cart[itemIndex].qty += delta;
      if (this.cart[itemIndex].qty <= 0) {
        this.cart.splice(itemIndex, 1);
      }
      if (this.currentRoute === "dashboard") {
        updateCartPanelDOM(cartItemId);
        updateProductBadgeDOM(prodId);
      }
    }
  }

  removeCartItem(cartItemId) {
    const item = this.cart.find(i => i.id === cartItemId);
    const prodId = item ? item.productId : null;
    this.cart = this.cart.filter(i => i.id !== cartItemId);
    if (this.currentRoute === "dashboard") {
      updateCartPanelDOM();
      if (prodId) updateProductBadgeDOM(prodId);
    }
  }

  clearCart() {
    this.cart = [];
    this.discount = { type: "none", value: 0 };
    this.orderNote = "";
    this.customer = { name: "Walk-in Customer", phone: "", id: "CUST-01" };
    
    if (this.currentRoute === "dashboard") {
      updateCartPanelDOM();
      document.querySelectorAll(".product-card").forEach(card => {
        card.classList.remove('in-cart', 'ring-2', 'ring-primary', 'ring-offset-1');
        const badge = card.querySelector('.product-qty-badge');
        if (badge) badge.remove();
      });
    }
  }

  // --- HOLD & RECALL (PARK & RESUME) ORDERS QUEUE ---
  holdCurrentOrder(referenceName = "") {
    if (this.cart.length === 0) return null;
    const defaultRef = `Token #${this.heldOrders.length + 1}`;
    const heldOrder = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      reference: (referenceName && referenceName.trim()) ? referenceName.trim() : defaultRef,
      customer: { ...this.customer },
      items: JSON.parse(JSON.stringify(this.cart)),
      discount: { ...this.discount },
      orderNote: this.orderNote,
      subtotal: this.getSubtotal(),
      tax: this.getTaxAmount(),
      total: this.getTotalDue(),
      itemCount: this.getItemCount(),
      timestamp: new Date().toISOString()
    };

    this.heldOrders.unshift(heldOrder);
    this.saveHeldOrders();

    // Clear active cart to take next customer order
    const previousProductIds = [...new Set(this.cart.map(i => i.productId))];
    this.cart = [];
    this.discount = { type: "none", value: 0 };
    this.orderNote = "";
    this.customer = { name: "Walk-in Customer", phone: "", id: "CUST-01" };

    if (this.currentRoute === "dashboard") {
      updateCartPanelDOM();
      previousProductIds.forEach(id => updateProductBadgeDOM(id));
      renderApp();
    }
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("held_orders", { type: "HELD_ORDERS_UPDATE", heldOrders: this.heldOrders });
    }
    return heldOrder;
  }

  recallHeldOrder(heldOrderId) {
    const orderIndex = this.heldOrders.findIndex(h => h.id === heldOrderId);
    if (orderIndex > -1) {
      const held = this.heldOrders[orderIndex];
      this.cart = JSON.parse(JSON.stringify(held.items));
      this.customer = { ...held.customer };
      this.discount = { ...held.discount };
      this.orderNote = held.orderNote || "";
      
      this.heldOrders.splice(orderIndex, 1);
      this.saveHeldOrders();

      if (this.currentRoute === "dashboard") {
        renderApp();
      }
      if (typeof cloudSync !== "undefined") {
        cloudSync.publish("held_orders", { type: "HELD_ORDERS_UPDATE", heldOrders: this.heldOrders });
      }
      return held;
    }
    return null;
  }

  deleteHeldOrder(heldOrderId) {
    this.heldOrders = this.heldOrders.filter(h => h.id !== heldOrderId);
    this.saveHeldOrders();
    if (this.currentRoute === "dashboard") {
      renderApp();
    }
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("held_orders", { type: "HELD_ORDERS_UPDATE", heldOrders: this.heldOrders });
    }
  }

  // --- SMART OFFER & COMBO RECOMMENDATION ENGINE (BEST VALUE SUGGESTER) ---
  getSmartOfferSuggestions() {
    if (!this.cart || this.cart.length === 0) return null;

    // 1. Map standalone (non-combo) quantities in cart by productId
    const standaloneInCart = {};
    let totalStandaloneQty = 0;

    this.cart.forEach(item => {
      if (!item.isCombo) {
        standaloneInCart[item.productId] = (standaloneInCart[item.productId] || 0) + item.qty;
        totalStandaloneQty += item.qty;
      }
    });

    // Only suggest when at least 2 items are in the cart
    if (totalStandaloneQty < 2) return null;

    const comboProducts = this.products.filter(p => p.isCombo && Array.isArray(p.comboItems) && p.comboItems.length >= 2);
    if (comboProducts.length === 0) return null;

    let bestOffer = null;
    let maxSavings = 0;

    comboProducts.forEach(combo => {
      let maxPossibleCombos = Infinity;
      let matchedItemsPriceSum = 0;
      let allItemsPresent = true;

      for (const ci of combo.comboItems) {
        const requiredPerCombo = ci.qty || 1;
        let availableInCart = standaloneInCart[ci.productId] || 0;
        
        // Fallback matching by name if IDs changed
        if (availableInCart === 0 && ci.name) {
          const matchByName = this.cart.find(item => !item.isCombo && item.name.toLowerCase() === ci.name.toLowerCase());
          if (matchByName) {
            availableInCart = standaloneInCart[matchByName.productId] || 0;
          }
        }

        const childProd = this.products.find(p => p.id === ci.productId) || this.products.find(p => p.name.toLowerCase() === ci.name?.toLowerCase());
        const unitPrice = childProd ? childProd.price : (ci.defaultPrice || 0);

        if (availableInCart < requiredPerCombo) {
          allItemsPresent = false;
          maxPossibleCombos = 0;
          break;
        }

        const possibleCombosForThisItem = Math.floor(availableInCart / requiredPerCombo);
        maxPossibleCombos = Math.min(maxPossibleCombos, possibleCombosForThisItem);
        matchedItemsPriceSum += (unitPrice * requiredPerCombo);
      }

      // ONLY suggest when ALL items of the combo deal are selected in the cart!
      if (allItemsPresent && maxPossibleCombos >= 1 && maxPossibleCombos !== Infinity) {
        const individualTotal = matchedItemsPriceSum * maxPossibleCombos;
        const comboTotal = combo.price * maxPossibleCombos;
        const savings = individualTotal - comboTotal;

        if (savings > 0 && savings > maxSavings) {
          maxSavings = savings;
          bestOffer = {
            type: "FULL_MATCH",
            comboId: combo.id,
            comboName: combo.name,
            comboPrice: combo.price,
            comboQty: maxPossibleCombos,
            individualTotal: individualTotal,
            comboTotal: comboTotal,
            savings: savings,
            savingsPercent: Math.round((savings / individualTotal) * 100),
            comboItems: combo.comboItems,
            message: `Selected items make "${combo.name}". Apply deal & save ${this.settings.currency}${savings.toFixed(2)} (${Math.round((savings / individualTotal) * 100)}% OFF)!`
          };
        }
      }
    });

    return bestOffer;
  }

  applySmartComboOffer(comboId, count = 1) {
    const combo = this.products.find(p => p.id === comboId && p.isCombo);
    if (!combo) return;

    // Deduct matched individual items from cart
    combo.comboItems.forEach(ci => {
      const requiredQty = (ci.qty || 1) * count;
      let remainingToDeduct = requiredQty;

      for (let i = this.cart.length - 1; i >= 0; i--) {
        const item = this.cart[i];
        if (!item.isCombo && item.productId === ci.productId) {
          if (item.qty <= remainingToDeduct) {
            remainingToDeduct -= item.qty;
            this.cart.splice(i, 1);
          } else {
            item.qty -= remainingToDeduct;
            remainingToDeduct = 0;
          }
          if (remainingToDeduct === 0) break;
        }
      }
    });

    // Add Combo item(s) to cart
    for (let c = 0; c < count; c++) {
      this.addToCart(combo);
    }

    if (this.currentRoute === "dashboard") {
      updateCartPanelDOM();
      renderApp();
    }

    showToast(`Best Offer Applied: "${combo.name}"!`, "success", "local_fire_department");
  }

  upgradeToSmartComboOffer(comboId) {
    const combo = this.products.find(p => p.id === comboId && p.isCombo);
    if (!combo) return;

    // Deduct available child items from cart
    combo.comboItems.forEach(ci => {
      const requiredQty = ci.qty || 1;
      let remainingToDeduct = requiredQty;

      for (let i = this.cart.length - 1; i >= 0; i--) {
        const item = this.cart[i];
        if (!item.isCombo && item.productId === ci.productId) {
          if (item.qty <= remainingToDeduct) {
            remainingToDeduct -= item.qty;
            this.cart.splice(i, 1);
          } else {
            item.qty -= remainingToDeduct;
            remainingToDeduct = 0;
          }
          if (remainingToDeduct === 0) break;
        }
      }
    });

    // Add Combo to cart
    this.addToCart(combo);

    if (this.currentRoute === "dashboard") {
      updateCartPanelDOM();
      renderApp();
    }

    showToast(`Upgraded to "${combo.name}" Combo Deal!`, "success", "local_fire_department");
  }

  // --- FINANCIAL CALCULATIONS (RUPEES ₹) ---
  getSubtotal() {
    return this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }

  getDiscountAmount() {
    const subtotal = this.getSubtotal();
    if (this.discount.type === "percent") {
      return (subtotal * this.discount.value) / 100;
    } else if (this.discount.type === "fixed") {
      return Math.min(subtotal, this.discount.value);
    }
    return 0;
  }

  getTaxAmount() {
    const discountedSubtotal = Math.max(0, this.getSubtotal() - this.getDiscountAmount());
    const rate = typeof this.settings.taxRate === "number" ? this.settings.taxRate : 0.0;
    if (rate <= 0) return 0.00;
    if (this.settings.taxMode === "inclusive") {
      return (discountedSubtotal * (rate / (100 + rate)));
    }
    return (discountedSubtotal * (rate / 100));
  }

  getTotalDue() {
    const subtotal = this.getSubtotal();
    const discount = this.getDiscountAmount();
    const tax = this.getTaxAmount();
    return Math.max(0, (subtotal - discount + tax));
  }

  getItemCount() {
    return this.cart.reduce((count, item) => count + item.qty, 0);
  }

  getItemCartQuantity(productId) {
    return this.cart
      .filter(item => item.productId === productId)
      .reduce((sum, item) => sum + item.qty, 0);
  }

  // --- ORDER PROCESSING & INVENTORY DEDUCTION (COMBO AWARE) ---
  completeOrder(paymentMethod, tenderDetails = {}) {
    const total = this.getTotalDue();
    const subtotal = this.getSubtotal();
    const tax = this.getTaxAmount();
    const discount = this.getDiscountAmount();
    const receiptNumber = `MGN-${Math.floor(100000 + Math.random() * 900000)}`;

    // Deduct stock in real-time for standalone and combo child items
    this.cart.forEach(cartItem => {
      const prod = this.products.find(p => p.id === cartItem.productId);
      if (prod) {
        if (prod.stock !== undefined) {
          prod.stock = Math.max(0, prod.stock - cartItem.qty);
        }
        // If combo meal, deduct inventory from bundled menu products
        if (prod.isCombo && Array.isArray(prod.comboItems)) {
          prod.comboItems.forEach(ci => {
            const childProd = this.products.find(p => p.id === ci.productId);
            if (childProd && childProd.stock !== undefined) {
              childProd.stock = Math.max(0, childProd.stock - ((ci.qty || 1) * cartItem.qty));
            }
          });
        }
      }
    });
    this.saveProducts();

    const kitchenToken = this.getNextKitchenToken();
    const newOrder = {
      receiptNumber: receiptNumber,
      id: `ord-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      kitchenToken: kitchenToken,
      kitchenStatus: "Pending", // "Pending" | "Preparing" | "Ready" | "Served"
      orderType: this.customer?.orderType || "Dine In",
      prepStartedAt: null,
      prepCompletedAt: null,
      checkedItems: {},
      date: new Date().toISOString(),
      displayDate: new Date().toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      customer: { ...this.customer },
      items: JSON.parse(JSON.stringify(this.cart)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      taxRate: this.settings.taxRate,
      total: parseFloat(total.toFixed(2)),
      paymentMethod: paymentMethod,
      tenderDetails: tenderDetails,
      orderNote: this.orderNote,
      cashier: this.settings.cashier,
      terminal: this.settings.terminal,
      status: "Completed"
    };

    if (paymentMethod === "Cash" && tenderDetails.amountReceived) {
      const cashReceived = parseFloat(tenderDetails.amountReceived);
      const changeGiven = parseFloat(tenderDetails.changeDue || 0);
      const netCash = cashReceived - changeGiven;
      this.drawer.cashSales += netCash;
      this.drawer.currentBalance += netCash;
      this.drawer.logs.unshift({
        time: new Date().toLocaleTimeString(),
        type: "Sale (Cash)",
        amount: netCash,
        receipt: receiptNumber
      });
      this.saveDrawer();
    } else if (paymentMethod === "Split Payment" && tenderDetails.cashPortion) {
      const netCash = parseFloat(tenderDetails.cashPortion);
      this.drawer.cashSales += netCash;
      this.drawer.currentBalance += netCash;
      this.drawer.logs.unshift({
        time: new Date().toLocaleTimeString(),
        type: "Sale (Split Cash)",
        amount: netCash,
        receipt: receiptNumber
      });
      this.saveDrawer();
    }

    this.orders.unshift(newOrder);
    this.saveOrders();
    this.activeTransaction = newOrder;

    // Broadcast to Kitchen Display System (KDS) & play audio chime alert
    this.broadcastKitchenEvent("NEW_ORDER", newOrder);
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("orders", { type: "NEW_ORDER", order: newOrder });
    }
    if (typeof playOrderSuccessChime === "function") {
      playOrderSuccessChime();
    } else if (typeof playKitchenAudioChime === "function") {
      playKitchenAudioChime();
    }
    if (typeof updateKitchenBadgeDOM === "function") {
      updateKitchenBadgeDOM();
    }

    return newOrder;
  }

  // --- KITCHEN DISPLAY SYSTEM (KDS) & ORDER PREPARATION MANAGEMENT ---
  getNextKitchenToken() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrdersCount = this.orders.filter(o => o.date && o.date.startsWith(todayStr)).length;
    return `Token #${String(todayOrdersCount + 1).padStart(2, '0')}`;
  }

  getActiveKitchenOrders(filter = "all") {
    const activeOrders = this.orders.filter(o => o.kitchenStatus && o.kitchenStatus !== "Served");
    
    if (filter === "pending") {
      return this.orders.filter(o => o.kitchenStatus === "Pending");
    } else if (filter === "preparing") {
      return this.orders.filter(o => o.kitchenStatus === "Preparing");
    } else if (filter === "ready") {
      return this.orders.filter(o => o.kitchenStatus === "Ready");
    } else if (filter === "history") {
      return this.orders.filter(o => o.kitchenStatus === "Served").slice(0, 20);
    }
    
    return activeOrders;
  }

  getPendingKitchenCount() {
    return this.orders.filter(o => o.kitchenStatus === "Pending" || o.kitchenStatus === "Preparing").length;
  }

  updateKitchenStatus(orderId, newStatus) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    order.kitchenStatus = newStatus;
    if (newStatus === "Preparing" && !order.prepStartedAt) {
      order.prepStartedAt = new Date().toISOString();
    } else if (newStatus === "Ready") {
      order.prepCompletedAt = new Date().toISOString();
    }

    this.saveOrders();
    this.broadcastKitchenEvent("STATUS_CHANGE", order);
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("status", { 
        type: "KITCHEN_STATUS_UPDATE", 
        orderId, 
        newStatus, 
        prepStartedAt: order.prepStartedAt, 
        prepCompletedAt: order.prepCompletedAt 
      });
    }

    if (typeof updateKitchenBadgeDOM === "function") {
      updateKitchenBadgeDOM();
    }

    if (this.currentRoute === "kitchen" && typeof updateKitchenScreenDOM === "function") {
      updateKitchenScreenDOM();
    }

    if (newStatus === "Ready") {
      if (typeof playOrderReadyChime === "function") {
        playOrderReadyChime();
      }
      showToast(`${order.kitchenToken || order.receiptNumber} is READY to Serve!`, "success", "room_service");
    } else if (newStatus === "Preparing") {
      showToast(`${order.kitchenToken || order.receiptNumber} cooking started`, "info", "soup_kitchen");
    } else if (newStatus === "Served") {
      if (typeof playOrderReadyChime === "function") {
        playOrderReadyChime();
      }
      showToast(`${order.kitchenToken || order.receiptNumber} served / completed`, "info", "check_circle");
    }
  }

  toggleKitchenItemChecked(orderId, itemIndex) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    if (!order.checkedItems) order.checkedItems = {};
    order.checkedItems[itemIndex] = !order.checkedItems[itemIndex];
    this.saveOrders();

    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("item_check", { type: "KITCHEN_ITEM_TOGGLE", orderId, itemIndex });
    }

    if (this.currentRoute === "kitchen" && typeof updateKitchenScreenDOM === "function") {
      updateKitchenScreenDOM();
    }
  }

  broadcastKitchenEvent(type, data) {
    try {
      if (typeof window !== "undefined" && window.BroadcastChannel) {
        const bc = new BroadcastChannel("mgn_pos_kds_channel");
        bc.postMessage({ type, data, timestamp: Date.now() });
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("mgn_kds_last_event", JSON.stringify({ type, data, timestamp: Date.now() }));
      }
    } catch (e) {}
  }

  deleteOrder(orderIdOrReceipt) {
    const index = this.orders.findIndex(o => o.id === orderIdOrReceipt || o.receiptNumber === orderIdOrReceipt);
    if (index > -1) {
      const removed = this.orders.splice(index, 1)[0];
      this.saveOrders();
      this.broadcastKitchenEvent("STATUS_CHANGE", { id: removed.id, kitchenStatus: "Served" });
      if (typeof cloudSync !== "undefined") {
        cloudSync.publish("delete", { type: "DELETE_ORDER", orderId: removed.id });
      }
      if (typeof updateKitchenBadgeDOM === "function") {
        updateKitchenBadgeDOM();
      }
      return true;
    }
    return false;
  }

  clearAllOrders() {
    this.orders = [];
    this.saveOrders();
    this.broadcastKitchenEvent("STATUS_CHANGE", { type: "CLEAR_ALL" });
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("clear", { type: "CLEAR_ALL_ORDERS" });
    }
    if (typeof updateKitchenBadgeDOM === "function") {
      updateKitchenBadgeDOM();
    }
  }

  deleteOrdersToday() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const beforeCount = this.orders.length;
    this.orders = this.orders.filter(o => {
      const orderDate = (o.date || o.timestamp || "").slice(0, 10);
      return orderDate !== todayStr;
    });
    this.saveOrders();
    this.broadcastKitchenEvent("STATUS_CHANGE", { type: "DELETE_TODAY" });
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("clear", { type: "CLEAR_ALL_ORDERS" });
    }
    if (typeof updateKitchenBadgeDOM === "function") {
      updateKitchenBadgeDOM();
    }
    return beforeCount - this.orders.length;
  }

  deleteOrdersOlderThan(days) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const beforeCount = this.orders.length;
    this.orders = this.orders.filter(o => {
      const t = new Date(o.date || o.timestamp).getTime();
      return t >= cutoff;
    });
    this.saveOrders();
    this.broadcastKitchenEvent("STATUS_CHANGE", { type: "DELETE_OLDER" });
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("clear", { type: "CLEAR_ALL_ORDERS" });
    }
    if (typeof updateKitchenBadgeDOM === "function") {
      updateKitchenBadgeDOM();
    }
    return beforeCount - this.orders.length;
  }
}

// Global State Instance
const pos = new POSState();

// Helper: Compress camera photo before saving to localStorage or transmitting
function compressImageFile(file, maxWidth = 250, maxHeight = 250, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

// Helper: Sanitize products so that payload stays ultra-compact for MQTT, QR, and clipboard
function getSanitizedProductsForSync(products) {
  if (!Array.isArray(products)) return [];
  return products.map(p => {
    const clean = {
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      costPrice: p.costPrice || 0,
      stock: p.stock !== undefined ? p.stock : 999,
      sku: p.sku || "",
      fallbackIcon: p.fallbackIcon || "restaurant",
      color: p.color || "#6b7280",
      isCombo: !!p.isCombo,
      comboItems: p.comboItems || [],
      portions: p.portions || null
    };
    if (p.img && (!p.img.startsWith("data:") || p.img.length < 15000)) {
      clean.img = p.img;
    }
    return clean;
  });
}

// Helper: Detect whether a product has portion pricing (Quarter / Half / Full)
function isPortionItem(product) {
  if (!product) return false;
  if (product.portions && product.portions.hasPortions) return true;
  const name = (product.name || "").toLowerCase();
  const cat = (product.category || "").toLowerCase();
  return name.includes("pizza") || cat.includes("pizza") ||
         name.includes("sweet corn") || name.includes("corn") || cat.includes("corn");
}

// Helper: Get portion prices (Quarter / Half / Full)
function getPortionPrices(product) {
  if (!product) return { quarter: 0, half: 0, full: 0 };
  const basePrice = parseFloat(product.price) || 0;
  if (product.portions && product.portions.hasPortions) {
    return {
      quarter: typeof product.portions.quarterPrice === "number" && product.portions.quarterPrice > 0 
        ? product.portions.quarterPrice 
        : Math.max(10, Math.round(basePrice * 0.35)),
      half: typeof product.portions.halfPrice === "number" && product.portions.halfPrice > 0 
        ? product.portions.halfPrice 
        : Math.max(20, Math.round(basePrice * 0.6)),
      full: typeof product.portions.fullPrice === "number" && product.portions.fullPrice > 0 
        ? product.portions.fullPrice 
        : basePrice
    };
  }
  return {
    quarter: Math.max(10, Math.round(basePrice * 0.35)),
    half: Math.max(20, Math.round(basePrice * 0.6)),
    full: basePrice
  };
}

// ==========================================
// 2B. MULTI-DEVICE REAL-TIME CLOUD SYNC ENGINE
// ==========================================

class CloudSyncManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.deviceId = `dev_${Math.random().toString(36).substring(2, 9)}`;
    this.brokerUrl = "wss://broker.emqx.io:8084/mqtt";
    this.roomCode = this.getInitialRoomCode();
  }

  getInitialRoomCode() {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get("room") || urlParams.get("sync");
      if (roomParam) {
        return roomParam.trim().toUpperCase();
      }
    }
    return (pos.settings.syncRoomCode || "MGN-CAFE-MAIN").trim().toUpperCase();
  }

  init() {
    if (typeof window === "undefined") return;

    // Auto-detect role from URL (e.g. ?role=kitchen)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("role") === "kitchen" || urlParams.get("mode") === "kitchen") {
      pos.currentRoute = "kitchen";
    }

    this.connect();
  }

  getTopic(suffix = "#") {
    const cleanRoom = this.roomCode.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    return `mgn_pos/${cleanRoom}/${suffix}`;
  }

  connect() {
    if (typeof window === "undefined") return;
    if (typeof mqtt === "undefined") {
      setTimeout(() => this.connect(), 1500);
      return;
    }

    try {
      if (this.client) {
        try { this.client.end(true); } catch (e) {}
      }

      this.updateStatusUI(false, "Connecting...");

      const options = {
        clientId: `${this.deviceId}_${Date.now()}`,
        clean: true,
        connectTimeout: 9000,
        reconnectPeriod: 4000,
        keepalive: 45
      };

      this.client = mqtt.connect(this.brokerUrl, options);

      this.client.on("connect", () => {
        this.isConnected = true;
        this.updateStatusUI(true, "Cloud Synced");
        console.log(`[CloudSync] Connected to Relay Broker for room: ${this.roomCode}`);

        // Subscribe to store room channel
        this.client.subscribe(this.getTopic("#"), { qos: 1 }, (err) => {
          if (!err) {
            // Request latest state from any active terminal
            this.publish("sync_req", { type: "SYNC_REQUEST", sender: this.deviceId, route: pos.currentRoute });
          }
        });
      });

      this.client.on("message", (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.handleInboundMessage(topic, payload);
        } catch (err) {
          console.error("[CloudSync] Message parse error:", err);
        }
      });

      this.client.on("offline", () => {
        this.isConnected = false;
        this.updateStatusUI(false, "Offline / Reconnecting");
      });

      this.client.on("error", (err) => {
        console.warn("[CloudSync] Broker error:", err);
        this.isConnected = false;
        this.updateStatusUI(false, "Sync Error");
      });

    } catch (err) {
      console.warn("[CloudSync] Connect error:", err);
      this.updateStatusUI(false, "Offline");
    }
  }

  publish(suffix, data, options = { qos: 1 }) {
    const payload = {
      ...data,
      sender: this.deviceId,
      room: this.roomCode,
      timestamp: Date.now()
    };

    if (this.client && this.isConnected) {
      try {
        this.client.publish(this.getTopic(suffix), JSON.stringify(payload), options);
      } catch (err) {
        console.warn("[CloudSync] Publish error:", err);
      }
    }
  }

  ensureConnected(callback) {
    if (this.client && this.isConnected) {
      callback();
      return;
    }
    this.connect();
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (this.client && this.isConnected) {
        clearInterval(interval);
        callback();
      } else if (attempts >= 12) {
        clearInterval(interval);
        showToast("⚠️ Could not connect to Cloud Relay. Check internet or use 'Share Menu (QR)'.", "error", "cloud_off", 5000);
      }
    }, 350);
  }

  uploadAllData() {
    showToast(`☁️ Connecting & Uploading ${pos.products.length} menu items...`, "info", "cloud_upload");
    this.ensureConnected(() => {
      const payload = {
        type: "FULL_CATALOG_SNAPSHOT",
        products: getSanitizedProductsForSync(pos.products),
        categories: pos.categories,
        settings: pos.settings,
        timestamp: Date.now()
      };
      // Retain on broker so any new device connecting gets it automatically
      this.publish("catalog_snapshot", payload, { qos: 1, retain: true });
      this.publish("catalog_broadcast", payload, { qos: 1 });
      showToast(`☁️ Uploaded ${pos.products.length} menu items to Store Cloud! (Room: ${this.roomCode})`, "success", "cloud_upload", 4000);
    });
  }

  requestFullSync() {
    showToast(`Connecting to Room [${this.roomCode}]...`, "info", "sync");
    this.ensureConnected(() => {
      this.publish("sync_req", { type: "SYNC_REQUEST", sender: this.deviceId, route: pos.currentRoute });
      showToast(`📡 Pulling menu from Room [${this.roomCode}]...`, "info", "cloud_download");

      const beforeCount = pos.products.length;
      setTimeout(() => {
        if (pos.products.length === beforeCount && (pos.products.length <= 2 && pos.products.some(p => p.name === "Chai" || p.name === "Coffee"))) {
          showToast(`⚠️ No response from Device 1 in Room [${this.roomCode}]. Please keep Device 1 open and click 'Upload Menu', OR tap 'Share Menu (QR)'!`, "warning", "warning", 6000);
        }
      }, 4000);
    });
  }

  handleInboundMessage(topic, payload) {
    if (!payload || payload.sender === this.deviceId) {
      return; // Ignore echo from self
    }

    console.log("[CloudSync] Received:", payload.type, payload);

    switch (payload.type) {
      case "FULL_CATALOG_SNAPSHOT":
      case "FULL_CATALOG_BROADCAST": {
        if (Array.isArray(payload.products) && payload.products.length > 0) {
          pos.products = payload.products;
          pos.saveProducts();
          if (Array.isArray(payload.categories) && payload.categories.length > 0) {
            payload.categories.forEach(c => {
              if (!pos.categories.includes(c)) pos.categories.push(c);
            });
            pos.saveCategories();
          }
          if (payload.settings) {
            pos.settings = { ...pos.settings, ...payload.settings };
            pos.saveSettings();
          }
          if (pos.currentRoute === "products-manager") updateProductManagerGridDOM();
          if (pos.currentRoute === "dashboard") renderApp();
          showToast(`☁️ Loaded ${payload.products.length} items from Store Cloud!`, "success", "cloud_download");
        }
        break;
      }
      case "NEW_ORDER": {
        const order = payload.order;
        if (!order || !order.id) return;
        
        const exists = pos.orders.some(o => o.id === order.id || o.receiptNumber === order.receiptNumber);
        if (!exists) {
          pos.orders.unshift(order);
          pos.saveOrders();
          updateKitchenBadgeDOM();

          if (pos.currentRoute === "kitchen") {
            updateKitchenScreenDOM();
            if (typeof playKitchenAudioChime === "function") {
              playKitchenAudioChime();
            }
          } else if (pos.currentRoute === "history" || pos.currentRoute === "analytics") {
            renderApp();
          }

          showToast(`🔔 New Order received: ${order.kitchenToken || order.receiptNumber}`, "info", "soup_kitchen");
        }
        break;
      }

      case "PRODUCT_ADD": {
        const { product } = payload;
        if (!product || !product.id) return;
        const exists = pos.products.some(p => p.id === product.id);
        if (!exists) {
          pos.products.unshift(product);
          if (product.category && !pos.categories.includes(product.category)) {
            pos.categories.push(product.category);
            pos.saveCategories();
          }
          pos.saveProducts();
          if (pos.currentRoute === "products-manager") updateProductManagerGridDOM();
          if (pos.currentRoute === "dashboard") updateProductGridDOM();
          showToast(`➕ New item "${product.name}" added to menu`, "info", "inventory_2");
        }
        break;
      }

      case "PRODUCT_UPDATE": {
        const { product } = payload;
        if (!product || !product.id) return;
        const idx = pos.products.findIndex(p => p.id === product.id);
        if (idx > -1) {
          pos.products[idx] = product;
          if (product.category && !pos.categories.includes(product.category)) {
            pos.categories.push(product.category);
            pos.saveCategories();
          }
          pos.saveProducts();
          if (pos.currentRoute === "products-manager") updateProductManagerGridDOM();
          if (pos.currentRoute === "dashboard") updateProductGridDOM();
          showToast(`✏️ Menu item "${product.name}" updated`, "info", "edit_note");
        }
        break;
      }

      case "PRODUCT_DELETE": {
        const { productId } = payload;
        pos.products = pos.products.filter(p => p.id !== productId);
        pos.saveProducts();
        if (pos.currentRoute === "products-manager") updateProductManagerGridDOM();
        if (pos.currentRoute === "dashboard") updateProductGridDOM();
        showToast(`🗑️ Menu item deleted by another device`, "info", "delete");
        break;
      }

      case "CATEGORY_ADD": {
        const { category } = payload;
        if (category && !pos.categories.includes(category)) {
          pos.categories.push(category);
          pos.saveCategories();
          if (pos.currentRoute === "products-manager") updateProductManagerGridDOM();
          if (pos.currentRoute === "dashboard") renderApp();
        }
        break;
      }

      case "CATEGORY_DELETE": {
        const { category, fallbackCategory } = payload;
        if (category && category !== "All Items") {
          pos.categories = pos.categories.filter(c => c !== category);
          const fallback = fallbackCategory || pos.categories.find(c => c !== "All Items") || "Beverages";
          pos.products.forEach(p => {
            if (p.category === category) p.category = fallback;
          });
          if (pos.activeCategory === category) pos.activeCategory = "All Items";
          if (pos.productManagerFilter === category) pos.productManagerFilter = "All Items";
          pos.saveCategories();
          pos.saveProducts();
          if (pos.currentRoute === "products-manager") updateProductManagerGridDOM();
          if (pos.currentRoute === "dashboard") renderApp();
          showToast(`🗑️ Category "${category}" deleted by another device`, "info", "delete");
        }
        break;
      }

      case "HELD_ORDERS_UPDATE": {
        if (Array.isArray(payload.heldOrders)) {
          pos.heldOrders = payload.heldOrders;
          pos.saveHeldOrders();
          if (pos.currentRoute === "dashboard") renderApp();
          showToast(`📋 Parked orders updated (${pos.heldOrders.length} waiting)`, "info", "pause_circle");
        }
        break;
      }

      case "KITCHEN_STATUS_UPDATE": {
        const { orderId, newStatus, prepStartedAt, prepCompletedAt } = payload;
        const order = pos.orders.find(o => o.id === orderId);
        if (order) {
          order.kitchenStatus = newStatus;
          if (prepStartedAt) order.prepStartedAt = prepStartedAt;
          if (prepCompletedAt) order.prepCompletedAt = prepCompletedAt;
          pos.saveOrders();
          updateKitchenBadgeDOM();

          if (pos.currentRoute === "kitchen") {
            updateKitchenScreenDOM();
          }

          if (newStatus === "Ready") {
            if (typeof playOrderReadyChime === "function") {
              playOrderReadyChime();
            }
            showToast(`🍽️ ${order.kitchenToken || order.receiptNumber} is READY to Serve!`, "success", "room_service");
          } else if (newStatus === "Served") {
            showToast(`${order.kitchenToken || order.receiptNumber} served / completed`, "info", "check_circle");
          }
        }
        break;
      }

      case "KITCHEN_ITEM_TOGGLE": {
        const { orderId, itemIndex } = payload;
        const order = pos.orders.find(o => o.id === orderId);
        if (order) {
          if (!order.checkedItems) order.checkedItems = {};
          order.checkedItems[itemIndex] = !order.checkedItems[itemIndex];
          pos.saveOrders();
          if (pos.currentRoute === "kitchen") {
            updateKitchenScreenDOM();
          }
        }
        break;
      }

      case "DELETE_ORDER": {
        const { orderId } = payload;
        const idx = pos.orders.findIndex(o => o.id === orderId);
        if (idx > -1) {
          pos.orders.splice(idx, 1);
          pos.saveOrders();
          updateKitchenBadgeDOM();
          if (pos.currentRoute === "kitchen") updateKitchenScreenDOM();
          if (pos.currentRoute === "history" || pos.currentRoute === "analytics") renderApp();
        }
        break;
      }

      case "CLEAR_ALL_ORDERS": {
        pos.orders = [];
        pos.saveOrders();
        updateKitchenBadgeDOM();
        if (pos.currentRoute === "kitchen") updateKitchenScreenDOM();
        if (pos.currentRoute === "history" || pos.currentRoute === "analytics") renderApp();
        showToast("Order history cleared across devices", "info", "delete_forever");
        break;
      }

      case "SETTINGS_UPDATE": {
        if (payload.settings) {
          pos.settings = { ...pos.settings, ...payload.settings };
          pos.saveSettings();
          renderApp();
          showToast(`⚙️ Store settings updated (GST: ${pos.settings.taxRate}%)`, "info", "settings");
        }
        break;
      }

      case "SYNC_REQUEST": {
        const sanitized = getSanitizedProductsForSync(pos.products);
        this.publish("sync_res", {
          type: "SYNC_RESPONSE",
          target: payload.sender,
          orders: pos.orders.slice(0, 10),
          products: sanitized,
          categories: pos.categories,
          heldOrders: pos.heldOrders,
          settings: pos.settings
        });
        break;
      }

      case "SYNC_RESPONSE": {
        if (payload.target === this.deviceId) {
          let updatedAny = false;
          if (payload.settings) {
            pos.settings = { ...pos.settings, ...payload.settings };
            pos.saveSettings();
            updatedAny = true;
          }
          if (Array.isArray(payload.orders) && payload.orders.length > 0) {
            payload.orders.forEach(incomingOrd => {
              const exists = pos.orders.some(o => o.id === incomingOrd.id);
              if (!exists) pos.orders.push(incomingOrd);
            });
            pos.orders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            pos.saveOrders();
            updatedAny = true;
          }
          if (Array.isArray(payload.products) && payload.products.length > 0) {
            if (payload.products.length >= pos.products.length) {
              pos.products = payload.products;
            } else {
              payload.products.forEach(p => {
                const idx = pos.products.findIndex(existing => existing.id === p.id);
                if (idx > -1) {
                  pos.products[idx] = p;
                } else {
                  pos.products.push(p);
                }
              });
            }
            pos.saveProducts();
            updatedAny = true;
          }
          if (Array.isArray(payload.categories) && payload.categories.length > 0) {
            payload.categories.forEach(c => {
              if (!pos.categories.includes(c)) pos.categories.push(c);
            });
            pos.saveCategories();
            updatedAny = true;
          }
          if (Array.isArray(payload.heldOrders)) {
            pos.heldOrders = payload.heldOrders;
            pos.saveHeldOrders();
            updatedAny = true;
          }
          updateKitchenBadgeDOM();
          if (pos.currentRoute === "kitchen") updateKitchenScreenDOM();
          if (pos.currentRoute === "products-manager") updateProductManagerGridDOM();
          if (pos.currentRoute === "dashboard") updateProductGridDOM();
          if (pos.currentRoute === "history" || pos.currentRoute === "analytics") renderApp();
          showToast("Synchronized with Store Cloud!", "success", "cloud_done");
        }
        break;
      }

      case "PING_TEST": {
        showToast(`📡 Live Sync Ping received from ${payload.senderRole || 'another tablet'}!`, "success", "wifi");
        if (typeof playOrderReadyChime === "function") {
          playOrderReadyChime();
        }
        break;
      }
    }
  }

  setRoomCode(newCode) {
    if (!newCode || !newCode.trim()) return;
    this.roomCode = newCode.trim().toUpperCase();
    pos.settings.syncRoomCode = this.roomCode;
    pos.saveSettings();
    this.connect();
    showToast(`Connected to Cloud Sync Room: ${this.roomCode}`, "success", "cloud");
  }

  updateStatusUI(isLive, labelText) {
    const dot = document.getElementById("sync-status-dot");
    const label = document.getElementById("sync-status-label");
    if (dot) {
      dot.className = isLive 
        ? "w-2 h-2 rounded-full bg-emerald-500 animate-pulse" 
        : "w-2 h-2 rounded-full bg-amber-500 animate-ping";
    }
    if (label) {
      label.textContent = isLive ? `Live (${this.roomCode})` : (labelText || "Connecting...");
    }
  }
}

const cloudSync = new CloudSyncManager();

// ==========================================
// 3. CARD POPUP & VISUAL PARTICLE FX
// ==========================================

function triggerCardPopEffect(cardElement) {
  if (!cardElement) return;

  cardElement.classList.remove('card-pop-active');
  void cardElement.offsetWidth;
  cardElement.classList.add('card-pop-active');
  setTimeout(() => cardElement.classList.remove('card-pop-active'), 340);

  const plusBadge = document.createElement('div');
  plusBadge.className = 'floating-plus-badge';
  plusBadge.innerHTML = `<span class="material-symbols-outlined text-[13px]">add</span><span>1</span>`;
  cardElement.appendChild(plusBadge);
  setTimeout(() => plusBadge.remove(), 600);
}

function showToast(message, type = "info", icon = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `pos-toast toast-${type}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 2200);
  }, 2200);
}

// ==========================================
// 4. ZERO-FLICKER IN-PLACE DOM UPDATERS
// ==========================================

function toggleMobileCart(open) {
  const drawer = document.getElementById("pos-order-panel");
  const backdrop = document.getElementById("pos-mobile-cart-backdrop");
  if (!drawer) return;
  
  if (open) {
    drawer.classList.remove("translate-y-full");
    drawer.classList.add("translate-y-0");
    if (backdrop) {
      backdrop.classList.remove("hidden");
      requestAnimationFrame(() => {
        backdrop.classList.remove("opacity-0");
        backdrop.classList.add("opacity-100");
      });
    }
  } else {
    drawer.classList.remove("translate-y-0");
    drawer.classList.add("translate-y-full");
    if (backdrop) {
      backdrop.classList.remove("opacity-100");
      backdrop.classList.add("opacity-0");
      setTimeout(() => {
        if (backdrop.classList.contains("opacity-0")) {
          backdrop.classList.add("hidden");
        }
      }, 250);
    }
  }
}

function updateCartPanelDOM(highlightCartId = null) {
  const itemsContainer = document.getElementById("cart-items-container");
  const subtotalEl = document.getElementById("cart-subtotal-val");
  const taxEl = document.getElementById("cart-tax-val");
  const discountBtn = document.getElementById("cart-discount-btn");
  const barDiscountBtn = document.getElementById("bar-discount-btn");
  const barItemCount = document.getElementById("bar-item-count");
  const barTotal = document.getElementById("bar-total-val");
  const proceedBtn = document.getElementById("proceed-payment-btn");
  const customerLabel = document.getElementById("cart-customer-name");
  const noteLabel = document.getElementById("cart-note-label");

  if (!itemsContainer) return;

  const subtotal = pos.getSubtotal();
  const tax = pos.getTaxAmount();
  const discount = pos.getDiscountAmount();
  const total = pos.getTotalDue();
  const itemCount = pos.getItemCount();

  if (customerLabel) customerLabel.textContent = pos.customer.name;
  if (noteLabel) noteLabel.textContent = pos.orderNote ? `Note: ${pos.orderNote}` : 'Add Order Note';

  if (pos.cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center flex-1 text-on-surface-variant gap-2 opacity-60 py-12">
        <span class="material-symbols-outlined text-[48px]">add_shopping_cart</span>
        <p class="font-headline-md font-semibold text-sm">Cart is empty</p>
        <p class="font-label-sm text-xs">Tap on any menu item to start order</p>
      </div>
    `;
  } else {
    itemsContainer.innerHTML = pos.cart.map(item => `
      <div 
        id="cart-row-${item.id}"
        class="cart-item-row flex items-center w-full min-h-[52px] bg-surface-container-lowest rounded-xl p-2.5 shadow-xs relative group overflow-hidden border border-outline-variant/30 ${highlightCartId === item.id ? 'highlight-flash' : ''}"
      >
        <div class="flex flex-col flex-1 min-w-0 pr-2">
          <div class="flex items-center gap-1.5">
            <span class="font-label-bold text-sm text-on-surface truncate font-bold leading-tight">${item.name}</span>
            ${item.isCombo ? `<span class="px-1.5 py-0.2 bg-amber-500/20 text-amber-800 text-[8.5px] font-black rounded uppercase">COMBO</span>` : ''}
          </div>
          <span class="text-xs text-on-surface-variant leading-none mt-1 truncate flex items-center gap-1">
            ${['Quarter', 'Half', 'Full'].includes(item.modifier) ? `
              <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 font-extrabold text-[10px] uppercase">${item.modifier}</span>
              <span class="text-[11px] text-on-surface-variant">· ${pos.settings.currency}${item.price.toFixed(2)}</span>
            ` : (item.isCombo && item.comboItems && item.comboItems.length > 0 ? item.comboItems.map(ci => `${ci.qty || 1}x ${ci.name}`).join(' + ') : (item.modifier || 'Standard'))}
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0 bg-surface-container rounded-full p-1 h-7 shadow-inner">
          <button 
            class="cart-decrement-btn w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface hover:bg-surface-variant shadow-xs transition-transform active:scale-90"
            data-cart-id="${item.id}"
          >
            <span class="material-symbols-outlined text-[13px]">remove</span>
          </button>
          <span class="font-bold text-xs text-on-surface w-4 text-center">${item.qty}</span>
          <button 
            class="cart-increment-btn w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface hover:bg-surface-variant shadow-xs transition-transform active:scale-90"
            data-cart-id="${item.id}"
          >
            <span class="material-symbols-outlined text-[13px]">add</span>
          </button>
        </div>
        <div class="w-16 text-right shrink-0 font-bold text-sm text-on-surface ml-1">
          ${pos.settings.currency}${(item.price * item.qty).toFixed(2)}
        </div>
        <button 
          class="cart-remove-btn opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-on-surface-variant hover:text-error"
          data-cart-id="${item.id}"
        >
          <span class="material-symbols-outlined text-[15px]">close</span>
        </button>
      </div>
    `).join('');
  }

  if (subtotalEl) subtotalEl.textContent = `${pos.settings.currency}${subtotal.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `${pos.settings.currency}${tax.toFixed(2)}`;
  const cartTaxLabel = document.getElementById("cart-tax-label");
  if (cartTaxLabel) {
    cartTaxLabel.textContent = (pos.settings.taxRate === 0 || !pos.settings.taxRate) ? 'Tax (0% Exempt)' : `GST (${pos.settings.taxRate}%)`;
  }
  if (discountBtn) {
    discountBtn.textContent = discount > 0 ? `-${pos.settings.currency}${discount.toFixed(2)}` : 'Add -';
  }
  if (barDiscountBtn) {
    barDiscountBtn.querySelector("span:last-child").textContent = discount > 0 ? 'Discount Active' : 'Add Discount';
  }
  if (barItemCount) barItemCount.textContent = `${itemCount} Items`;
  if (barTotal) barTotal.textContent = `${pos.settings.currency}${total.toFixed(2)}`;

  // Mobile elements in-place sync
  const mobileBarTotal = document.getElementById("mobile-bar-total-val");
  const mobileCartBar = document.getElementById("pos-mobile-cart-bar");
  const mobileCartCount = document.getElementById("header-mobile-cart-count");
  const mobileBarBadge = document.getElementById("mobile-bar-badge");
  const mobileProceedBtn = document.getElementById("mobile-proceed-payment-btn");
  const mobileDiscountText = document.getElementById("mobile-bar-discount-text");
  const drawerProceedBtn = document.getElementById("drawer-proceed-btn");

  if (mobileBarTotal) {
    mobileBarTotal.textContent = `${pos.settings.currency}${total.toFixed(2)}`;
  }
  if (mobileBarBadge) {
    mobileBarBadge.textContent = itemCount;
  }
  if (mobileDiscountText) {
    mobileDiscountText.textContent = discount > 0 ? 'Discount' : 'Disc';
  }
  if (mobileCartCount) {
    mobileCartCount.textContent = itemCount;
  }
  if (mobileCartBar) {
    if (itemCount > 0) {
      mobileCartBar.classList.remove("hidden");
    } else {
      mobileCartBar.classList.add("hidden");
      toggleMobileCart(false);
    }
  }
  if (mobileProceedBtn) {
    if (itemCount === 0) {
      mobileProceedBtn.classList.add('opacity-50', 'cursor-not-allowed');
      mobileProceedBtn.setAttribute('disabled', 'true');
    } else {
      mobileProceedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      mobileProceedBtn.removeAttribute('disabled');
    }
  }
  if (drawerProceedBtn) {
    const proceedSpan = drawerProceedBtn.querySelector('span');
    if (proceedSpan) {
      proceedSpan.textContent = `Proceed to Payment (${pos.settings.currency}${total.toFixed(2)})`;
    }
    if (itemCount === 0) {
      drawerProceedBtn.classList.add('opacity-50', 'cursor-not-allowed');
      drawerProceedBtn.setAttribute('disabled', 'true');
    } else {
      drawerProceedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      drawerProceedBtn.removeAttribute('disabled');
    }
  }

  const bottomBar = document.getElementById("pos-bottom-bar");
  const mainRow = document.getElementById("pos-main-dashboard-row");

  if (itemCount === 0) {
    if (bottomBar) {
      bottomBar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
      bottomBar.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
    }
    if (mainRow) {
      mainRow.classList.remove('h-[calc(100vh-64px-72px)]');
      mainRow.classList.add('h-[calc(100vh-64px)]');
    }
  } else {
    if (bottomBar) {
      bottomBar.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
      bottomBar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
    }
    if (mainRow) {
      mainRow.classList.remove('h-[calc(100vh-64px)]');
      mainRow.classList.add('h-[calc(100vh-64px-72px)]');
    }
  }

  if (proceedBtn) {
    if (itemCount === 0) {
      proceedBtn.classList.add('opacity-50', 'cursor-not-allowed');
      proceedBtn.setAttribute('disabled', 'true');
    } else {
      proceedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      proceedBtn.removeAttribute('disabled');
    }
  }

  // Smart Offer / Best Combo Deal Suggester Dynamic Render
  const offerContainer = document.getElementById("cart-smart-offer-container");
  if (offerContainer) {
    const offer = pos.getSmartOfferSuggestions();
    if (offer) {
      offerContainer.classList.remove("hidden");
      offerContainer.innerHTML = `
        <div class="w-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/10 border border-amber-500/30 rounded-2xl p-3 shadow-xs animate-fade-in-up flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs animate-bounce">
                <span class="material-symbols-outlined text-[14px]">local_fire_department</span>
              </div>
              <span class="font-headline-md text-xs font-bold text-amber-900 tracking-wide uppercase">Best Offer Available</span>
            </div>
            ${offer.type === 'FULL_MATCH' ? `
              <span class="px-2 py-0.5 bg-amber-600 text-white font-extrabold text-[10px] rounded-full shadow-xs">
                Save ${pos.settings.currency}${offer.savings.toFixed(2)} (${offer.savingsPercent}% OFF)
              </span>
            ` : `
              <span class="px-2 py-0.5 bg-orange-600 text-white font-extrabold text-[10px] rounded-full shadow-xs">
                Smart Deal
              </span>
            `}
          </div>

          <p class="font-body-md text-xs text-on-surface leading-tight font-medium">
            ${offer.message}
          </p>

          <div class="flex items-center gap-2 mt-0.5">
            ${offer.type === 'FULL_MATCH' ? `
              <button 
                onclick="pos.applySmartComboOffer('${offer.comboId}', ${offer.comboQty})"
                class="w-full h-9 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <span class="material-symbols-outlined text-[16px]">bolt</span>
                Apply Deal (Save ${pos.settings.currency}${offer.savings.toFixed(2)})
              </button>
            ` : `
              <button 
                onclick="pos.upgradeToSmartComboOffer('${offer.comboId}')"
                class="w-full h-9 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <span class="material-symbols-outlined text-[16px]">add_circle</span>
                Upgrade to Combo Deal (+${pos.settings.currency}${offer.extraCost.toFixed(2)})
              </button>
            `}
          </div>
        </div>
      `;
    } else {
      offerContainer.classList.add("hidden");
      offerContainer.innerHTML = '';
    }
  }

  bindCartRowEvents();
}

function updateProductBadgeDOM(productId) {
  const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
  if (!card) return;

  const inCartQty = pos.getItemCartQuantity(productId);
  let badgeEl = card.querySelector('.product-qty-badge');

  if (inCartQty > 0) {
    card.classList.add('in-cart', 'ring-2', 'ring-primary', 'ring-offset-1');

    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.className = 'product-qty-badge absolute top-2.5 right-2.5 h-6 px-2 bg-primary text-on-primary font-label-bold text-xs rounded-full flex items-center justify-center shadow-lg z-20 animate-badge-pop border-2 border-surface gap-1';
      badgeEl.innerHTML = `<span class="material-symbols-outlined text-[13px]">shopping_bag</span><span>${inCartQty}</span>`;
      card.appendChild(badgeEl);
    } else {
      badgeEl.innerHTML = `<span class="material-symbols-outlined text-[13px]">shopping_bag</span><span>${inCartQty}</span>`;
      badgeEl.classList.remove('animate-badge-pop');
      void badgeEl.offsetWidth;
      badgeEl.classList.add('animate-badge-pop');
    }
  } else {
    card.classList.remove('in-cart', 'ring-2', 'ring-primary', 'ring-offset-1');
    if (badgeEl) badgeEl.remove();
  }
}

function updateProductGridDOM() {
  const gridContainer = document.getElementById("product-grid-container");
  if (!gridContainer) return;

  const filteredProducts = pos.products.filter(p => {
    const matchesCategory = pos.activeCategory === "All Items" || p.category === pos.activeCategory;
    const matchesSearch = !pos.searchQuery || p.name.toLowerCase().includes(pos.searchQuery.toLowerCase()) || p.category.toLowerCase().includes(pos.searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (filteredProducts.length === 0) {
    if (pos.products.length === 0) {
      gridContainer.innerHTML = `
        <div class="col-span-full py-16 flex flex-col items-center justify-center text-center text-on-surface-variant gap-3 bg-surface-container-low/50 rounded-2xl border-2 border-dashed border-outline-variant/40 p-8 my-auto">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-[36px]">restaurant_menu</span>
          </div>
          <div class="flex flex-col gap-1">
            <h3 class="font-headline-md text-base font-bold text-on-surface">No Products in Menu</h3>
            <p class="font-body-md text-xs text-on-surface-variant max-w-sm">Your menu catalog is completely clean. Click below to add your first cafe product.</p>
          </div>
          <button 
            onclick="setRoute('products'); setTimeout(() => openProductModal(), 100);"
            class="h-10 px-5 rounded-xl bg-primary text-on-primary font-headline-md text-xs flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95 mt-2"
          >
            <span class="material-symbols-outlined text-[16px]">add_circle</span>
            + Add First Product
          </button>
        </div>
      `;
    } else {
      gridContainer.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center h-64 text-on-surface-variant gap-3 py-10">
          <span class="material-symbols-outlined text-[52px]">search_off</span>
          <p class="font-headline-md font-semibold text-base">No products found</p>
          <p class="font-body-md text-xs opacity-80">Try adjusting your search or category filter</p>
        </div>
      `;
    }
  } else {
    gridContainer.innerHTML = filteredProducts.map(p => {
      const inCartQty = pos.getItemCartQuantity(p.id);
      const isPortion = isPortionItem(p);
      const portionPrices = isPortion ? getPortionPrices(p) : null;

      return `
        <div class="relative group">
          <div 
            class="product-card pm-draggable-card relative flex flex-col w-full bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/30 shadow-[0_2px_8px_rgba(0,0,0,0.04)] group hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] group-hover:border-primary/40 transition-all duration-200 h-[200px] sm:h-[218px] text-left cursor-grab active:cursor-grabbing ${inCartQty > 0 ? 'in-cart ring-2 ring-primary ring-offset-1' : ''}"
            data-product-id="${p.id}"
            draggable="true"
            role="button"
            tabindex="0"
          >
            ${inCartQty > 0 ? `
              <div class="product-qty-badge absolute top-2.5 right-2.5 h-6 px-2 bg-primary text-on-primary font-label-bold text-xs rounded-full flex items-center justify-center shadow-lg z-20 animate-badge-pop border-2 border-surface gap-1">
                <span class="material-symbols-outlined text-[13px]">shopping_bag</span>
                <span>${inCartQty}</span>
              </div>
            ` : ''}

            <!-- Large Image Area -->
            <div class="img-container w-full h-[126px] sm:h-[145px] bg-surface-container shrink-0 relative overflow-hidden flex items-center justify-center rounded-t-2xl">
              ${p.img ? `
                <img 
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  src="${p.img}" 
                  alt="${p.name}"
                  onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                />
                <div class="w-full h-full hidden items-center justify-center" style="background-color: ${p.color || '#e0ecfe'}">
                  <span class="material-symbols-outlined text-[48px] text-primary">${p.fallbackIcon || (isPortion ? 'local_pizza' : 'lunch_dining')}</span>
                </div>
              ` : `
                <div class="w-full h-full flex items-center justify-center" style="background-color: ${p.color || '#e0ecfe'}">
                  <div class="w-full h-1.5 absolute top-0 left-0 bg-primary/20"></div>
                  <span class="material-symbols-outlined text-[48px] text-primary">${p.fallbackIcon || (isPortion ? 'local_pizza' : 'local_cafe')}</span>
                </div>
              `}

              ${p.isCombo ? `
                <div class="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[9.5px] rounded-full shadow-md z-10 flex items-center gap-0.5 uppercase tracking-wider">
                  <span class="material-symbols-outlined text-[11px]">local_fire_department</span>
                  COMBO
                </div>
              ` : isPortion ? `
                <div class="absolute top-2.5 left-2.5 px-2 py-0.5 bg-amber-600/90 backdrop-blur-md text-white font-black text-[9px] rounded-full shadow-md z-10 flex items-center gap-0.5 uppercase tracking-wider">
                  <span class="material-symbols-outlined text-[11px]">pie_chart</span>
                  PORTIONS
                </div>
              ` : ''}

              <!-- Customization Tune Button -->
              <button 
                type="button"
                onclick="event.stopPropagation(); ${isPortion ? `openPortionSelectionModal('${p.id}');` : `openItemCustomizePopup('${p.id}');`}"
                class="absolute ${inCartQty > 0 ? 'top-10' : 'top-2.5'} right-2.5 w-7 h-7 rounded-full bg-surface/90 backdrop-blur-md hover:bg-primary hover:text-white text-on-surface-variant flex items-center justify-center transition-all opacity-100 lg:opacity-0 group-hover:opacity-100 shadow-sm z-10 border border-outline-variant/30 active:scale-90"
                title="${isPortion ? 'Select Portion' : 'Customize Item'}"
              >
                <span class="material-symbols-outlined text-[14px]">${isPortion ? 'pie_chart' : 'tune'}</span>
              </button>
            </div>

            <!-- Content Area (Name + Price in Same Row, Clean & Well-Organized) -->
            <div class="flex flex-col px-3 py-2 flex-1 justify-between bg-surface-container-lowest rounded-b-2xl">
              <!-- Main Row: Name (Left) & Price (Right) in the SAME row -->
              <div class="flex items-center justify-between gap-2 w-full">
                <span class="font-bold text-[13.5px] text-on-surface line-clamp-1 leading-snug flex-1">${p.name}</span>
                ${isPortion ? `
                  <div class="flex flex-col items-end shrink-0 text-right leading-none">
                    <span class="font-display text-[13.5px] font-extrabold text-primary tabular-nums">${pos.settings.currency}${portionPrices.quarter} - ${portionPrices.full}</span>
                  </div>
                ` : `
                  <span class="font-display text-[15px] font-extrabold text-primary tabular-nums shrink-0 text-right">${pos.settings.currency}${p.price.toFixed(2)}</span>
                `}
              </div>

              <!-- Subtitle Row: Category / Combo info & Low stock indicator -->
              <div class="flex items-center justify-between gap-2 w-full text-[11px] text-on-surface-variant/80">
                ${isPortion ? `
                  <span class="text-[9.5px] font-extrabold text-amber-800 bg-amber-500/15 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[11px]">pie_chart</span>
                    Quarter · Half · Full
                  </span>
                ` : p.isCombo && p.comboItems && p.comboItems.length > 0 ? `
                  <span class="text-[10px] font-bold text-amber-700 truncate flex items-center gap-0.5 flex-1">
                    <span class="material-symbols-outlined text-[11px]">fastfood</span>
                    ${p.comboItems.length} Items Bundle
                  </span>
                ` : `
                  <span class="font-medium truncate flex-1">${p.category}</span>
                `}

                ${(p.stock !== undefined && p.stock < 10) ? `
                  <span class="text-[9.5px] font-bold text-error bg-error-container/60 px-1.5 py-0.5 rounded shrink-0">${p.stock} left</span>
                ` : `
                  <span class="text-[10px] font-mono opacity-60 shrink-0">${p.sku}</span>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  bindProductCardEvents();
  bindAllDragAndDropGrids();
}

function updateProductManagerGridDOM() {
  const pmGrid = document.getElementById("pm-products-grid");
  const countBadge = document.getElementById("pm-total-count-badge");
  if (countBadge) countBadge.textContent = `${pos.products.length} Total Items`;

  if (!pmGrid) {
    renderApp();
    return;
  }

  const filteredProducts = pos.products.filter(p => {
    const matchesCategory = pos.productManagerFilter === "All Items" || p.category === pos.productManagerFilter;
    const matchesSearch = !pos.productManagerSearch || p.name.toLowerCase().includes(pos.productManagerSearch.toLowerCase()) || p.sku.toLowerCase().includes(pos.productManagerSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (filteredProducts.length === 0) {
    if (pos.products.length === 0) {
      pmGrid.innerHTML = `
        <div class="col-span-full py-16 flex flex-col items-center justify-center text-center text-on-surface-variant gap-3 bg-surface-container-lowest rounded-2xl border-2 border-dashed border-outline-variant/40 p-8 my-auto">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-[36px]">add_a_photo</span>
          </div>
          <div class="flex flex-col gap-1">
            <h3 class="font-headline-md text-base font-bold text-on-surface">No Products in Catalog</h3>
            <p class="font-body-md text-xs text-on-surface-variant max-w-sm">Your catalog is completely clean. Click below to add your first menu item with custom price, photo, and modifiers.</p>
          </div>
          <button 
            onclick="openProductModal()"
            class="h-11 px-6 rounded-xl bg-primary text-on-primary font-headline-md text-xs flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95 mt-2"
          >
            <span class="material-symbols-outlined text-[18px]">add_circle</span>
            + Add First Product
          </button>
        </div>
      `;
    } else {
      pmGrid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center h-64 text-on-surface-variant gap-3">
          <span class="material-symbols-outlined text-[48px] text-on-surface-variant/50">inventory</span>
          <p class="font-headline-md font-semibold">No products found in this filter</p>
          <button onclick="openProductModal()" class="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-bold text-sm shadow-md active:scale-95">
            + Add New Product
          </button>
        </div>
      `;
    }
  } else {
    pmGrid.innerHTML = filteredProducts.map((product, idx) => `
      <div 
        class="pm-draggable-card bg-surface-container-lowest rounded-2xl p-3 shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:shadow-md transition-all group relative cursor-grab active:cursor-grabbing"
        draggable="true"
        data-pm-id="${product.id}"
        data-pm-index="${idx}"
      >
        <div class="w-full h-36 rounded-xl bg-surface-container relative overflow-hidden flex items-center justify-center mb-2.5">
          ${product.img ? `
            <img src="${product.img}" alt="${product.name}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="w-full h-full hidden items-center justify-center" style="background-color: ${product.color || '#eff4ff'}">
              <span class="material-symbols-outlined text-[36px] text-primary">${product.fallbackIcon || 'lunch_dining'}</span>
            </div>
          ` : `
            <div class="w-full h-full flex items-center justify-center" style="background-color: ${product.color || '#eff4ff'}">
              <span class="material-symbols-outlined text-[40px] text-primary">${product.fallbackIcon || 'local_cafe'}</span>
            </div>
          `}
          
          <span class="absolute top-2 left-2 px-2 py-0.5 bg-inverse-surface/80 text-inverse-on-surface rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
            ${product.category}
          </span>

          ${product.isCombo ? `
            <span class="absolute top-2 right-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[9.5px] rounded-md shadow-md flex items-center gap-0.5 uppercase tracking-wider">
              <span class="material-symbols-outlined text-[11px]">local_fire_department</span>
              COMBO
            </span>
          ` : ''}

          <div class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs rounded text-white text-[10px] font-mono flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="material-symbols-outlined text-[11px]">drag_indicator</span>
            #${idx + 1}
          </div>
        </div>

        <div class="flex flex-col gap-1 mb-2">
          <div class="flex justify-between items-start">
            <h3 class="font-label-bold text-sm text-on-surface font-bold line-clamp-1">${product.name}</h3>
          </div>
          <div class="flex justify-between items-center text-xs text-on-surface-variant">
            <span>SKU: ${product.sku}</span>
            <span class="font-bold text-sm text-primary font-headline-md">${pos.settings.currency}${product.price.toFixed(2)}</span>
          </div>
          <div class="flex justify-between items-center text-[11px] text-on-surface-variant/80 mt-0.5">
            <span>Cost: ${pos.settings.currency}${(product.costPrice || product.price * 0.4).toFixed(2)}</span>
            <span class="px-2 py-0.5 rounded-full ${ (product.stock || 0) < 10 ? 'bg-error-container text-on-error-container font-bold' : 'bg-surface-container font-semibold' }">Stock: ${product.stock || 0}</span>
          </div>
          ${product.isCombo && product.comboItems && product.comboItems.length > 0 ? `
            <div class="text-[10px] text-amber-700 font-bold bg-amber-500/10 px-2 py-0.5 rounded mt-1 truncate">
              Includes: ${product.comboItems.map(ci => `${ci.qty || 1}x ${ci.name}`).join(' + ')}
            </div>
          ` : isPortionItem(product) ? `
            <div class="text-[10px] text-amber-800 font-bold bg-amber-500/10 px-2 py-0.5 rounded mt-1 flex items-center justify-between">
              <span>Portions:</span>
              <span>Q: ${pos.settings.currency}${getPortionPrices(product).quarter} · H: ${pos.settings.currency}${getPortionPrices(product).half} · F: ${pos.settings.currency}${getPortionPrices(product).full}</span>
            </div>
          ` : ''}
        </div>

        <!-- Position Controls & Edit/Delete Actions -->
        <div class="flex items-center gap-1.5 pt-2 border-t border-outline-variant/20">
          <button 
            onclick="event.stopPropagation(); pos.reorderProduct('${product.id}', 'left');"
            class="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors active:scale-90 ${idx === 0 ? 'opacity-30 pointer-events-none' : ''}"
            title="Move Position Left / Up"
          >
            <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          </button>
          
          <button 
            onclick="event.stopPropagation(); pos.reorderProduct('${product.id}', 'right');"
            class="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors active:scale-90 ${idx === filteredProducts.length - 1 ? 'opacity-30 pointer-events-none' : ''}"
            title="Move Position Right / Down"
          >
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>

          <button 
            onclick="openProductModal('${product.id}')"
            class="flex-1 h-8 rounded-lg bg-surface-container hover:bg-surface-variant text-primary font-label-bold text-xs flex items-center justify-center gap-1 transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[15px]">edit</span>
            Edit
          </button>
          
          <button 
            onclick="confirmDeleteProduct('${product.id}', '${escape(product.name)}')"
            class="w-8 h-8 rounded-lg bg-error-container/40 hover:bg-error-container text-on-error-container flex items-center justify-center transition-colors active:scale-95"
            title="Delete Product"
          >
            <span class="material-symbols-outlined text-[15px]">delete</span>
          </button>
        </div>
      </div>
    `).join('');
  }
  bindAllDragAndDropGrids();
}

let isCurrentlyDragging = false;
let lastDragEndTime = 0;

function setupUniversalDragAndDrop(gridContainerId, cardSelector, dataIdAttribute, onReorder) {
  const container = document.getElementById(gridContainerId);
  if (!container) return;

  const cards = container.querySelectorAll(cardSelector);
  let draggedCard = null;
  let draggedId = null;
  let touchClone = null;
  let currentDropTarget = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let isTouchDragActive = false;
  let touchHoldTimer = null;

  cards.forEach(card => {
    card.setAttribute("draggable", "true");

    // --- HTML5 MOUSE DRAG & DROP (DESKTOP) ---
    card.ondragstart = (e) => {
      draggedCard = card;
      draggedId = card.getAttribute(dataIdAttribute) || card.dataset.productId || card.dataset.pmId;
      isCurrentlyDragging = true;
      try {
        e.dataTransfer.setData("text/plain", draggedId);
        e.dataTransfer.effectAllowed = "move";
      } catch (err) {}
      setTimeout(() => {
        card.classList.add("opacity-40", "scale-95", "border-primary", "border-dashed");
      }, 0);
    };

    card.ondragend = () => {
      card.classList.remove("opacity-40", "scale-95", "border-primary", "border-dashed");
      container.querySelectorAll(cardSelector).forEach(c => {
        c.classList.remove("drag-over-target", "border-primary", "border-2", "bg-primary/5");
      });
      draggedCard = null;
      draggedId = null;
      lastDragEndTime = Date.now();
      setTimeout(() => { isCurrentlyDragging = false; }, 120);
    };

    card.ondragover = (e) => {
      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = "move";
      } catch (err) {}
      if (draggedCard && card !== draggedCard) {
        card.classList.add("drag-over-target");
      }
    };

    card.ondragleave = () => {
      card.classList.remove("drag-over-target");
    };

    card.ondrop = (e) => {
      e.preventDefault();
      card.classList.remove("drag-over-target");
      const targetId = card.getAttribute(dataIdAttribute) || card.dataset.productId || card.dataset.pmId;
      if (draggedId && targetId && draggedId !== targetId) {
        onReorder(draggedId, targetId);
      }
      draggedCard = null;
      draggedId = null;
      lastDragEndTime = Date.now();
      setTimeout(() => { isCurrentlyDragging = false; }, 120);
    };

    // --- TOUCH DRAG & DROP (TABLETS, MOBILES, TOUCH MONITORS) ---
    card.addEventListener("touchstart", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select") || e.target.closest("a")) {
        return;
      }
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      draggedId = card.getAttribute(dataIdAttribute) || card.dataset.productId || card.dataset.pmId;
      draggedCard = card;
      isTouchDragActive = false;

      clearTimeout(touchHoldTimer);
      touchHoldTimer = setTimeout(() => {
        isTouchDragActive = true;
        isCurrentlyDragging = true;
        card.classList.add("opacity-40", "scale-95");

        touchClone = card.cloneNode(true);
        touchClone.id = "active-touch-drag-clone";
        touchClone.style.position = "fixed";
        touchClone.style.zIndex = "999999";
        touchClone.style.pointerEvents = "none";
        touchClone.style.width = `${card.offsetWidth}px`;
        touchClone.style.height = `${card.offsetHeight}px`;
        touchClone.style.top = `${touch.clientY - card.offsetHeight / 2}px`;
        touchClone.style.left = `${touch.clientX - card.offsetWidth / 2}px`;
        touchClone.style.opacity = "0.92";
        touchClone.style.transform = "scale(1.06) rotate(2deg)";
        touchClone.style.boxShadow = "0 16px 32px rgba(0, 0, 0, 0.28)";
        touchClone.style.transition = "none";
        document.body.appendChild(touchClone);

        if (navigator.vibrate) {
          try { navigator.vibrate(35); } catch (vErr) {}
        }
      }, 150);
    }, { passive: true });

    card.addEventListener("touchmove", (e) => {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);

      if (!isTouchDragActive && (deltaX > 8 || deltaY > 8)) {
        clearTimeout(touchHoldTimer);
      }

      if (isTouchDragActive && touchClone) {
        if (e.cancelable) e.preventDefault();
        touchClone.style.top = `${touch.clientY - touchClone.offsetHeight / 2}px`;
        touchClone.style.left = `${touch.clientX - touchClone.offsetWidth / 2}px`;

        touchClone.style.display = "none";
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        touchClone.style.display = "block";

        const dropTarget = elementBelow ? elementBelow.closest(cardSelector) : null;
        if (dropTarget && dropTarget !== draggedCard && container.contains(dropTarget)) {
          if (currentDropTarget && currentDropTarget !== dropTarget) {
            currentDropTarget.classList.remove("drag-over-target");
          }
          currentDropTarget = dropTarget;
          currentDropTarget.classList.add("drag-over-target");
        } else if (currentDropTarget) {
          currentDropTarget.classList.remove("drag-over-target");
          currentDropTarget = null;
        }
      }
    }, { passive: false });

    card.addEventListener("touchend", () => {
      clearTimeout(touchHoldTimer);
      if (isTouchDragActive) {
        isTouchDragActive = false;
        if (touchClone) {
          touchClone.remove();
          touchClone = null;
        }
        card.classList.remove("opacity-40", "scale-95");

        if (currentDropTarget) {
          currentDropTarget.classList.remove("drag-over-target");
          const targetId = currentDropTarget.getAttribute(dataIdAttribute) || currentDropTarget.dataset.productId || currentDropTarget.dataset.pmId;
          if (draggedId && targetId && draggedId !== targetId) {
            onReorder(draggedId, targetId);
          }
          currentDropTarget = null;
        }
        lastDragEndTime = Date.now();
        setTimeout(() => { isCurrentlyDragging = false; }, 120);
      }
      draggedCard = null;
      draggedId = null;
    });

    card.addEventListener("touchcancel", () => {
      clearTimeout(touchHoldTimer);
      if (touchClone) {
        touchClone.remove();
        touchClone = null;
      }
      if (currentDropTarget) {
        currentDropTarget.classList.remove("drag-over-target");
        currentDropTarget = null;
      }
      card.classList.remove("opacity-40", "scale-95");
      isTouchDragActive = false;
      draggedCard = null;
      draggedId = null;
      lastDragEndTime = Date.now();
      setTimeout(() => { isCurrentlyDragging = false; }, 120);
    });
  });
}

function bindAllDragAndDropGrids() {
  // 1. Menu & Inventory Manager Grid
  setupUniversalDragAndDrop("pm-products-grid", ".pm-draggable-card", "data-pm-id", (draggedId, targetId) => {
    const fromIndex = pos.products.findIndex(p => p.id === draggedId);
    const toIndex = pos.products.findIndex(p => p.id === targetId);
    if (fromIndex > -1 && toIndex > -1 && fromIndex !== toIndex) {
      pos.moveProductToIndex(fromIndex, toIndex);
    }
  });

  // 2. POS Register Grid (Dashboard)
  setupUniversalDragAndDrop("product-grid-container", ".product-card", "data-product-id", (draggedId, targetId) => {
    const fromIndex = pos.products.findIndex(p => p.id === draggedId);
    const toIndex = pos.products.findIndex(p => p.id === targetId);
    if (fromIndex > -1 && toIndex > -1 && fromIndex !== toIndex) {
      pos.moveProductToIndex(fromIndex, toIndex);
    }
  });
}

function updateCalculationDisplay() {
  const inputEl = document.getElementById("amount-received-input");
  const changeEl = document.getElementById("calc-change-display");
  const changeBadgeEl = document.getElementById("calc-change-badge-container");
  const confirmBtn = document.getElementById("confirm-cash-payment-btn");

  if (!inputEl) return;

  const total = pos.getTotalDue();
  const received = parseFloat(pos.calcInput) || 0;
  const change = received - total;

  inputEl.value = pos.calcInput;

  if (changeEl) {
    if (change >= 0) {
      changeEl.className = "font-display-price text-[54px] leading-tight font-bold text-secondary";
      changeEl.textContent = `${pos.settings.currency}${change.toFixed(2)}`;
    } else {
      changeEl.className = "font-display-price text-[54px] leading-tight font-bold text-error";
      changeEl.textContent = `-${pos.settings.currency}${Math.abs(change).toFixed(2)}`;
    }
  }

  if (changeBadgeEl) {
    if (change >= 0) {
      changeBadgeEl.innerHTML = `
        <div class="h-6 px-3 rounded-full bg-secondary-container flex items-center justify-center">
          <span class="font-label-sm text-xs text-on-secondary-container font-bold">Due to Customer</span>
        </div>
      `;
    } else {
      changeBadgeEl.innerHTML = `
        <div class="h-6 px-3 rounded-full bg-error-container flex items-center justify-center">
          <span class="font-label-sm text-xs text-on-error-container font-bold">Insufficient Amount</span>
        </div>
      `;
    }
  }

  if (confirmBtn) {
    if (change < 0) {
      confirmBtn.classList.add("opacity-50", "cursor-not-allowed");
      confirmBtn.setAttribute("disabled", "true");
    } else {
      confirmBtn.classList.remove("opacity-50", "cursor-not-allowed");
      confirmBtn.removeAttribute("disabled");
    }
  }
}

// ==========================================
// 5. ROUTING & SCREEN RENDERERS
// ==========================================

function setRoute(route) {
  pos.currentRoute = route;
  
  if (route === "calculation") {
    const total = pos.getTotalDue();
    pos.calcInput = (Math.ceil(total / 100) * 100 || 500).toFixed(2);
  } else if (route === "confirmation") {
    if (typeof playOrderSuccessChime === "function") {
      playOrderSuccessChime();
    }
  }
  
  renderApp();
}

function renderApp() {
  const appContainer = document.getElementById("app-root");
  if (!appContainer) return;

  const headerStore = document.getElementById("header-store-name");
  const headerBranch = document.getElementById("header-store-branch");
  const headerCashier = document.getElementById("header-cashier-name");
  if (headerStore) headerStore.textContent = pos.settings.storeName;
  if (headerBranch) headerBranch.textContent = `${pos.settings.storeBranch}`;
  if (headerCashier) headerCashier.textContent = pos.settings.cashier;

  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.remove("active");
    if (el.dataset.route === pos.currentRoute) {
      el.classList.add("active");
    }
  });

  const mobileCartBtn = document.getElementById("header-mobile-cart-btn");
  const mobileCartCount = document.getElementById("header-mobile-cart-count");
  if (mobileCartBtn) {
    if (pos.currentRoute === "dashboard") {
      mobileCartBtn.classList.remove("hidden");
    } else {
      mobileCartBtn.classList.add("hidden");
    }
  }
  if (mobileCartCount) {
    mobileCartCount.textContent = pos.getItemCount();
  }
  if (typeof updateKitchenBadgeDOM === "function") {
    updateKitchenBadgeDOM();
  }

  let mainContentHtml = "";
  switch (pos.currentRoute) {
    case "dashboard":
      mainContentHtml = renderDashboardView();
      break;
    case "analytics":
      mainContentHtml = renderAnalyticsView();
      break;
    case "products-manager":
      mainContentHtml = renderProductsManagerView();
      break;
    case "payment-method":
      mainContentHtml = renderPaymentMethodView();
      break;
    case "calculation":
      mainContentHtml = renderCalculationView();
      break;
    case "confirmation":
      mainContentHtml = renderConfirmationView();
      break;
    case "history":
      mainContentHtml = renderHistoryView();
      break;
    case "kitchen":
      mainContentHtml = renderKitchenView();
      break;
    case "settings":
      mainContentHtml = renderSettingsView();
      break;
    default:
      mainContentHtml = renderDashboardView();
  }

  appContainer.innerHTML = mainContentHtml;
  bindEventListeners();
}

// ==========================================
// SCREEN 1: POS DASHBOARD VIEW (RUPEES ₹)
// ==========================================

function renderDashboardView() {
  const subtotal = pos.getSubtotal();
  const tax = pos.getTaxAmount();
  const discount = pos.getDiscountAmount();
  const total = pos.getTotalDue();
  const itemCount = pos.getItemCount();

  const filteredProducts = pos.products.filter(p => {
    const matchesCategory = pos.activeCategory === "All Items" || p.category === pos.activeCategory;
    const matchesSearch = !pos.searchQuery || p.name.toLowerCase().includes(pos.searchQuery.toLowerCase()) || p.category.toLowerCase().includes(pos.searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return `
  <div class="flex flex-col w-full h-full relative animate-screen-enter select-none">
    <div id="pos-main-dashboard-row" class="flex flex-row w-full ${itemCount > 0 ? 'h-[calc(100vh-64px)] lg:h-[calc(100vh-64px-76px)]' : 'h-[calc(100vh-64px)]'} overflow-hidden pb-16 lg:pb-0">
      
      <!-- Product Workspace (Full on mobile, 68% on Desktop) -->
      <div class="flex-1 w-full lg:w-[68%] flex flex-col h-full bg-surface overflow-hidden relative shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
        
        <!-- Top Search & Categories -->
        <div class="p-3 sm:p-margin-edge pb-2 flex flex-col gap-2.5 sm:gap-3 shrink-0 z-10 relative">
          <div class="relative w-full">
            <div class="absolute inset-y-0 left-0 pl-3.5 sm:pl-gutter flex items-center pointer-events-none text-on-surface-variant">
              <span class="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input 
              id="product-search-input"
              class="w-full h-[44px] sm:h-[48px] pl-[42px] sm:pl-[48px] pr-[40px] sm:pr-[44px] rounded-full bg-surface-container-highest text-on-surface font-body-lg text-sm sm:text-base placeholder-on-surface-variant outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all shadow-xs" 
              placeholder="Search for products or categories..." 
              type="text"
              value="${pos.searchQuery}"
            />
            <button 
              id="clear-search-btn"
              class="absolute inset-y-0 right-0 pr-gutter flex items-center text-on-surface-variant hover:text-on-surface transition-colors ${pos.searchQuery ? '' : 'opacity-40'}"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="flex flex-row items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
            ${pos.categories.map(cat => `
              <button 
                class="category-chip shrink-0 h-[36px] px-3.5 sm:px-4 rounded-full font-label-bold text-xs transition-all active:scale-95 ${pos.activeCategory === cat ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'}"
                data-category="${cat}"
              >
                ${cat}
              </button>
            `).join('')}
            
            <button 
              onclick="openAddCategoryModal()"
              class="shrink-0 h-[36px] px-3.5 rounded-full border border-dashed border-primary text-primary hover:bg-primary/5 font-label-bold text-xs flex items-center gap-1.5 transition-colors"
              title="Manage & Delete Categories"
            >
              <span class="material-symbols-outlined text-[16px]">category</span>
              Manage Categories
            </button>
          </div>
        </div>

        <!-- Product Grid Container -->
        <div class="flex-1 overflow-y-auto px-3 sm:px-margin-edge pb-24 lg:pb-margin-edge pt-1">
          <div id="product-grid-container" class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 auto-rows-max">
            ${filteredProducts.length === 0 ? `
              ${pos.products.length === 0 ? `
                <div class="col-span-full py-16 flex flex-col items-center justify-center text-center text-on-surface-variant gap-3 bg-surface-container-low/50 rounded-2xl border-2 border-dashed border-outline-variant/40 p-8 my-auto">
                  <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-[36px]">restaurant_menu</span>
                  </div>
                  <div class="flex flex-col gap-1">
                    <h3 class="font-headline-md text-base font-bold text-on-surface">No Products in Menu</h3>
                    <p class="font-body-md text-xs text-on-surface-variant max-w-sm">Your menu catalog is completely clean. Click below to add your first cafe product.</p>
                  </div>
                  <button 
                    onclick="setRoute('products'); setTimeout(() => openProductModal(), 100);"
                    class="h-10 px-5 rounded-xl bg-primary text-on-primary font-headline-md text-xs flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95 mt-2"
                  >
                    <span class="material-symbols-outlined text-[16px]">add_circle</span>
                    + Add First Product
                  </button>
                </div>
              ` : `
                <div class="col-span-full flex flex-col items-center justify-center h-64 text-on-surface-variant gap-3 py-10">
                  <span class="material-symbols-outlined text-[52px]">search_off</span>
                  <p class="font-headline-md font-semibold text-base">No products found</p>
                  <p class="font-body-md text-xs opacity-80">Try adjusting your search or category filter</p>
                </div>
              `}
            ` : filteredProducts.map(p => {
              const inCartQty = pos.getItemCartQuantity(p.id);
              return `
                <div class="relative group">
                  <div 
                    class="product-card pm-draggable-card relative flex flex-col w-full bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/30 shadow-[0_2px_8px_rgba(0,0,0,0.04)] group hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] group-hover:border-primary/40 transition-all duration-200 h-[200px] sm:h-[218px] text-left cursor-grab active:cursor-grabbing ${inCartQty > 0 ? 'in-cart ring-2 ring-primary ring-offset-1' : ''}"
                    data-product-id="${p.id}"
                    draggable="true"
                    role="button"
                    tabindex="0"
                  >
                    ${inCartQty > 0 ? `
                      <div class="product-qty-badge absolute top-2.5 right-2.5 h-6 px-2 bg-primary text-on-primary font-label-bold text-xs rounded-full flex items-center justify-center shadow-lg z-20 animate-badge-pop border-2 border-surface gap-1">
                        <span class="material-symbols-outlined text-[13px]">shopping_bag</span>
                        <span>${inCartQty}</span>
                      </div>
                    ` : ''}

                    <!-- Large Image Area -->
                    <div class="img-container w-full h-[126px] sm:h-[145px] bg-surface-container shrink-0 relative overflow-hidden flex items-center justify-center rounded-t-2xl">
                      ${p.img ? `
                        <img 
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          src="${p.img}" 
                          alt="${p.name}"
                          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        />
                        <div class="w-full h-full hidden items-center justify-center" style="background-color: ${p.color || '#e0ecfe'}">
                          <span class="material-symbols-outlined text-[48px] text-primary">${p.fallbackIcon || 'lunch_dining'}</span>
                        </div>
                      ` : `
                        <div class="w-full h-full flex items-center justify-center" style="background-color: ${p.color || '#e0ecfe'}">
                          <div class="w-full h-1.5 absolute top-0 left-0 bg-primary/20"></div>
                          <span class="material-symbols-outlined text-[48px] text-primary">${p.fallbackIcon || 'local_cafe'}</span>
                        </div>
                      `}

                      ${p.isCombo ? `
                        <div class="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[9.5px] rounded-full shadow-md z-10 flex items-center gap-0.5 uppercase tracking-wider">
                          <span class="material-symbols-outlined text-[11px]">local_fire_department</span>
                          COMBO
                        </div>
                      ` : ''}

                      <!-- Customization Tune Button -->
                      <button 
                        type="button"
                        onclick="event.stopPropagation(); openItemCustomizePopup('${p.id}');"
                        class="absolute ${inCartQty > 0 ? 'top-10' : 'top-2.5'} right-2.5 w-7 h-7 rounded-full bg-surface/90 backdrop-blur-md hover:bg-primary hover:text-white text-on-surface-variant flex items-center justify-center transition-all opacity-100 lg:opacity-0 group-hover:opacity-100 shadow-sm z-10 border border-outline-variant/30 active:scale-90"
                        title="Customize Item"
                      >
                        <span class="material-symbols-outlined text-[14px]">tune</span>
                      </button>
                    </div>

                    <!-- Content Area (Name + Price in Same Row, Clean & Well-Organized) -->
                    <div class="flex flex-col px-3 py-2 flex-1 justify-between bg-surface-container-lowest rounded-b-2xl">
                      <!-- Main Row: Name (Left) & Price (Right) in the SAME row -->
                      <div class="flex items-center justify-between gap-2 w-full">
                        <span class="font-bold text-[13.5px] text-on-surface line-clamp-1 leading-snug flex-1">${p.name}</span>
                        <span class="font-display text-[15px] font-extrabold text-primary tabular-nums shrink-0 text-right">${pos.settings.currency}${p.price.toFixed(2)}</span>
                      </div>

                      <!-- Subtitle Row: Category / Combo info & Low stock indicator -->
                      <div class="flex items-center justify-between gap-2 w-full text-[11px] text-on-surface-variant/80">
                        ${p.isCombo && p.comboItems && p.comboItems.length > 0 ? `
                          <span class="text-[10px] font-bold text-amber-700 truncate flex items-center gap-0.5 flex-1">
                            <span class="material-symbols-outlined text-[11px]">fastfood</span>
                            ${p.comboItems.length} Items Bundle
                          </span>
                        ` : `
                          <span class="font-medium truncate flex-1">${p.category}</span>
                        `}

                        ${(p.stock !== undefined && p.stock < 10) ? `
                          <span class="text-[9.5px] font-bold text-error bg-error-container/60 px-1.5 py-0.5 rounded shrink-0">${p.stock} left</span>
                        ` : `
                          <span class="text-[10px] font-mono opacity-60 shrink-0">${p.sku}</span>
                        `}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Mobile Cart Sheet Backdrop -->
      <div id="pos-mobile-cart-backdrop" onclick="toggleMobileCart(false)" class="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs hidden opacity-0 transition-opacity"></div>

      <!-- Current Order Panel (Desktop: 32% Side Panel | Mobile: Slide-Up Bottom Sheet Drawer) -->
      <div id="pos-order-panel" class="fixed lg:static inset-x-0 bottom-0 z-50 lg:z-20 w-full lg:w-[32%] lg:min-w-[340px] lg:max-w-[420px] h-[88vh] lg:h-full bg-surface-container-low rounded-t-3xl lg:rounded-none shadow-2xl lg:shadow-[4px_0_12px_rgba(0,0,0,0.05)] border-t lg:border-t-0 lg:border-l border-outline-variant/30 flex flex-col transition-transform duration-300 ease-in-out translate-y-full lg:translate-y-0">
        
        <!-- Mobile Drawer Grab Handle -->
        <div class="lg:hidden w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto my-2 shrink-0"></div>

        <!-- Cart Header (Comfortable 56px) -->
        <div class="h-14 flex items-center justify-between px-4 shrink-0 bg-surface-container-low border-b border-outline-variant/20">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">shopping_cart</span>
            <span class="font-headline-md text-base font-bold text-on-surface">Current Order</span>
          </div>
          
          <div class="flex items-center gap-1.5">
            ${pos.heldOrders && pos.heldOrders.length > 0 ? `
              <button 
                id="held-orders-badge-btn"
                onclick="openHeldOrdersModal()" 
                class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border border-amber-500/30 font-label-bold text-xs transition-all animate-pulse-slow shadow-xs active:scale-95"
                title="View Held Orders Queue"
              >
                <span class="material-symbols-outlined text-[15px]">pause_circle</span>
                <span>Held (${pos.heldOrders.length})</span>
              </button>
            ` : ''}

            <button 
              id="hold-current-cart-btn"
              onclick="openHoldOrderModal()"
              class="text-on-surface-variant hover:text-amber-600 transition-colors p-1.5 rounded-full hover:bg-surface-container-highest ${pos.cart.length === 0 ? 'opacity-40 pointer-events-none' : ''}"
              title="Hold Active Order (Park)"
            >
              <span class="material-symbols-outlined text-[19px]">pause_circle</span>
            </button>

            <button 
              id="open-clear-modal-btn"
              class="text-on-surface-variant hover:text-error transition-colors p-1.5 rounded-full hover:bg-surface-container-highest"
              title="Clear Cart"
            >
              <span class="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>

            <!-- Mobile Close Sheet Button -->
            <button 
              type="button"
              onclick="toggleMobileCart(false)"
              class="lg:hidden text-on-surface-variant hover:text-on-surface transition-colors p-1.5 rounded-full hover:bg-surface-container-highest ml-1"
              title="Close Cart View"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <!-- Customer Selector -->
        <div class="px-4 pt-2.5 pb-2 shrink-0">
          <button 
            id="select-customer-btn"
            class="w-full h-10 bg-surface-container rounded-xl flex items-center justify-between px-3 text-on-surface-variant hover:bg-surface-container-highest transition-colors shadow-xs active:scale-98"
          >
            <div class="flex items-center gap-2 truncate">
              <span class="material-symbols-outlined text-[17px] text-primary">person_add</span>
              <span id="cart-customer-name" class="font-label-bold text-xs text-on-surface truncate font-semibold">${pos.customer.name}</span>
            </div>
            <span class="material-symbols-outlined text-[17px]">chevron_right</span>
          </button>
        </div>

        <!-- Smart Offer & Combo Recommendation Banner -->
        <div id="cart-smart-offer-container" class="px-4 pb-1 shrink-0 ${pos.getSmartOfferSuggestions() ? '' : 'hidden'}">
          ${(() => {
            const offer = pos.getSmartOfferSuggestions();
            if (!offer) return '';
            return `
              <div class="w-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/10 border border-amber-500/30 rounded-2xl p-3 shadow-xs animate-fade-in-up flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs animate-bounce">
                      <span class="material-symbols-outlined text-[14px]">local_fire_department</span>
                    </div>
                    <span class="font-headline-md text-xs font-bold text-amber-900 tracking-wide uppercase">Best Offer Available</span>
                  </div>
                  ${offer.type === 'FULL_MATCH' ? `
                    <span class="px-2 py-0.5 bg-amber-600 text-white font-extrabold text-[10px] rounded-full shadow-xs">
                      Save ${pos.settings.currency}${offer.savings.toFixed(2)} (${offer.savingsPercent}% OFF)
                    </span>
                  ` : `
                    <span class="px-2 py-0.5 bg-orange-600 text-white font-extrabold text-[10px] rounded-full shadow-xs">
                      Smart Deal
                    </span>
                  `}
                </div>

                <p class="font-body-md text-xs text-on-surface leading-tight font-medium">
                  ${offer.message}
                </p>

                <div class="flex items-center gap-2 mt-0.5">
                  ${offer.type === 'FULL_MATCH' ? `
                    <button 
                      onclick="pos.applySmartComboOffer('${offer.comboId}', ${offer.comboQty})"
                      class="w-full h-9 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <span class="material-symbols-outlined text-[16px]">bolt</span>
                      Apply Deal (Save ${pos.settings.currency}${offer.savings.toFixed(2)})
                    </button>
                  ` : `
                    <button 
                      onclick="pos.upgradeToSmartComboOffer('${offer.comboId}')"
                      class="w-full h-9 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <span class="material-symbols-outlined text-[16px]">add_circle</span>
                      Upgrade to Combo Deal (+${pos.settings.currency}${offer.extraCost.toFixed(2)})
                    </button>
                  `}
                </div>
              </div>
            `;
          })()}
        </div>

        <!-- Scrollable Cart Items -->
        <div id="cart-items-container" class="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-2">
          ${pos.cart.length === 0 ? `
            <div class="flex flex-col items-center justify-center flex-1 text-on-surface-variant gap-2 opacity-60 py-10">
              <span class="material-symbols-outlined text-[42px]">add_shopping_cart</span>
              <p class="font-headline-md font-semibold text-sm">Cart is empty</p>
              <p class="font-label-sm text-xs">Tap on any menu item to start order</p>
            </div>
          ` : pos.cart.map(item => `
            <div 
              id="cart-row-${item.id}"
              class="cart-item-row flex items-center w-full min-h-[52px] bg-surface-container-lowest rounded-xl p-2.5 shadow-xs relative group overflow-hidden border border-outline-variant/30"
            >
              <div class="flex flex-col flex-1 min-w-0 pr-2">
                <div class="flex items-center gap-1.5">
                  <span class="font-label-bold text-sm text-on-surface truncate font-bold leading-tight">${item.name}</span>
                  ${item.isCombo ? `<span class="px-1.5 py-0.2 bg-amber-500/20 text-amber-800 text-[8.5px] font-black rounded uppercase">COMBO</span>` : ''}
                </div>
                <span class="text-xs text-on-surface-variant leading-none mt-1 truncate flex items-center gap-1">
                  ${['Quarter', 'Half', 'Full'].includes(item.modifier) ? `
                    <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 font-extrabold text-[10px] uppercase">${item.modifier}</span>
                    <span class="text-[11px] text-on-surface-variant">· ${pos.settings.currency}${item.price.toFixed(2)}</span>
                  ` : (item.isCombo && item.comboItems && item.comboItems.length > 0 ? item.comboItems.map(ci => `${ci.qty || 1}x ${ci.name}`).join(' + ') : (item.modifier || 'Standard'))}
                </span>
              </div>
              <div class="flex items-center gap-1 shrink-0 bg-surface-container rounded-full p-1 h-7 shadow-inner">
                <button 
                  class="cart-decrement-btn w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface hover:bg-surface-variant shadow-xs transition-transform active:scale-90"
                  data-cart-id="${item.id}"
                >
                  <span class="material-symbols-outlined text-[13px]">remove</span>
                </button>
                <span class="font-bold text-xs text-on-surface w-4 text-center">${item.qty}</span>
                <button 
                  class="cart-increment-btn w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface hover:bg-surface-variant shadow-xs transition-transform active:scale-90"
                  data-cart-id="${item.id}"
                >
                  <span class="material-symbols-outlined text-[13px]">add</span>
                </button>
              </div>
              <div class="w-16 text-right shrink-0 font-bold text-sm text-on-surface ml-1">
                ${pos.settings.currency}${(item.price * item.qty).toFixed(2)}
              </div>
              <button 
                class="cart-remove-btn opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-on-surface-variant hover:text-error"
                data-cart-id="${item.id}"
              >
                <span class="material-symbols-outlined text-[15px]">close</span>
              </button>
            </div>
          `).join('')}

          <button 
            id="add-note-btn"
            class="w-full h-8.5 mt-1 border border-dashed border-outline-variant rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors gap-1.5 shrink-0 active:scale-98 text-xs font-medium"
          >
            <span class="material-symbols-outlined text-[15px]">edit_note</span>
            <span id="cart-note-label" class="text-xs">${pos.orderNote ? `Note: ${pos.orderNote}` : 'Add Order Note'}</span>
          </button>
        </div>

        <!-- Totals Breakdown & Mobile Proceed Button -->
        <div class="px-4 py-2.5 shrink-0 bg-surface-container-low border-t border-outline-variant/30 flex flex-col gap-1 text-xs">
          <div class="flex justify-between items-center text-on-surface-variant font-label-sm">
            <span class="uppercase tracking-wider">Subtotal</span>
            <span id="cart-subtotal-val" class="font-semibold text-sm text-on-surface">${pos.settings.currency}${subtotal.toFixed(2)}</span>
          </div>
          <div class="flex justify-between items-center text-on-surface-variant font-label-sm">
            <span id="cart-tax-label" class="uppercase tracking-wider">${(pos.settings.taxRate === 0 || !pos.settings.taxRate) ? 'Tax (0% Exempt)' : `GST (${pos.settings.taxRate}%)`}</span>
            <span id="cart-tax-val" class="font-semibold text-sm text-on-surface">${pos.settings.currency}${tax.toFixed(2)}</span>
          </div>
          <div class="flex justify-between items-center text-on-surface-variant font-label-sm">
            <span class="uppercase tracking-wider text-primary font-bold">Discount</span>
            <button id="cart-discount-btn" class="font-bold text-xs text-primary hover:underline underline-offset-2">
              ${discount > 0 ? `-${pos.settings.currency}${discount.toFixed(2)}` : 'Add -'}
            </button>
          </div>

          <!-- Mobile Sheet Full Proceed Button -->
          <button 
            id="drawer-proceed-btn"
            onclick="toggleMobileCart(false); setRoute('payment-method');"
            class="lg:hidden w-full h-12 mt-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl font-headline-md text-sm font-bold flex items-center justify-between px-4 shadow-md active:scale-[0.98] transition-all ${itemCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
            ${itemCount === 0 ? 'disabled' : ''}
          >
            <span>Proceed to Payment (${pos.settings.currency}${total.toFixed(2)})</span>
            <div class="w-6 h-6 bg-on-primary/20 rounded-full flex items-center justify-center backdrop-blur-xs">
              <span class="material-symbols-outlined text-on-primary text-[15px]">arrow_forward</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Sticky Proceed to Payment Bar (Docks right above bottom nav when cart has items) -->
    <div 
      id="pos-mobile-cart-bar" 
      class="lg:hidden fixed bottom-16 md:bottom-0 inset-x-0 z-40 bg-surface-container-highest/98 backdrop-blur-xl border-t-2 border-primary/30 px-3 py-2.5 shadow-[0_-4px_24px_rgba(0,0,0,0.18)] flex items-center justify-between select-none ${itemCount > 0 ? '' : 'hidden'}"
    >
      <!-- Left: Tap to open cart drawer & view order -->
      <div onclick="toggleMobileCart(true)" class="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform flex-1 min-w-0 pr-2" title="Tap to view cart items">
        <div class="relative w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
          <span class="material-symbols-outlined text-[22px]">shopping_bag</span>
          <span id="mobile-bar-badge" class="absolute -top-1.5 -right-1.5 h-4.5 min-w-4.5 px-1 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-surface">${itemCount}</span>
        </div>
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Total Due</span>
            <span class="text-[10.5px] text-primary font-bold flex items-center">
              <span>(View Cart)</span>
              <span class="material-symbols-outlined text-[13px]">expand_less</span>
            </span>
          </div>
          <span id="mobile-bar-total-val" class="font-display-price text-base sm:text-lg font-black text-on-surface leading-tight tabular-nums truncate">${pos.settings.currency}${total.toFixed(2)}</span>
        </div>
      </div>

      <!-- Right: Discount & Proceed to Payment Buttons -->
      <div class="flex items-center gap-2 shrink-0">
        <button 
          type="button" 
          id="mobile-bar-discount-btn"
          onclick="openDiscountModal()"
          class="h-10 px-2.5 rounded-xl border border-primary/30 bg-surface hover:bg-surface-container text-primary font-label-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
          title="Apply Discount"
        >
          <span class="material-symbols-outlined text-[16px]">sell</span>
          <span id="mobile-bar-discount-text">${discount > 0 ? 'Discount' : 'Disc'}</span>
        </button>

        <button 
          type="button" 
          id="mobile-proceed-payment-btn"
          onclick="if (pos.cart.length > 0) setRoute('payment-method')"
          class="h-10 px-4 bg-primary hover:bg-primary/90 text-on-primary rounded-xl font-headline-md text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${itemCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
          ${itemCount === 0 ? 'disabled' : ''}
        >
          <span class="tracking-wide font-bold">Proceed</span>
          <div class="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-xs">
            <span class="material-symbols-outlined text-white text-[14px]">arrow_forward</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Desktop Persistent Bottom Action Bar (Sleek 76px, Appears only when cart has items) -->
    <div id="pos-bottom-bar" class="hidden lg:flex absolute bottom-0 left-0 w-full h-[76px] bg-surface-container-highest shadow-[0_-4px_16px_rgba(0,0,0,0.1)] items-center justify-between px-6 z-40 border-t border-outline-variant/30 ${itemCount > 0 ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}">
      <div class="flex items-center gap-5">
        <button 
          id="bar-clear-btn"
          class="h-11 px-3.5 rounded-xl flex items-center gap-2 text-on-surface-variant hover:bg-surface-container-high hover:text-error transition-all active:scale-95 group text-xs font-label-bold"
        >
          <span class="material-symbols-outlined text-[18px]">delete</span>
          <span>Clear All</span>
        </button>
        <div class="flex items-center gap-2 text-on-surface">
          <span class="material-symbols-outlined text-on-surface-variant text-[20px]">shopping_bag</span>
          <span id="bar-item-count" class="font-label-bold text-sm font-bold">${itemCount} Items</span>
        </div>
        <div class="w-px h-7 bg-outline-variant/50"></div>
        <div class="flex flex-col">
          <span class="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">Total Due</span>
          <span id="bar-total-val" class="font-display-price text-[28px] leading-tight text-on-surface font-black">${pos.settings.currency}${total.toFixed(2)}</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button 
          id="bar-discount-btn"
          class="h-12 px-4 border-2 border-primary text-primary rounded-xl flex items-center gap-2 font-label-bold text-xs hover:bg-primary/5 transition-all active:scale-[0.98]"
        >
          <span class="material-symbols-outlined text-[18px]">sell</span>
          <span>${discount > 0 ? 'Discount Active' : 'Add Discount'}</span>
        </button>
        <button 
          id="proceed-payment-btn"
          onclick="if (pos.cart.length > 0) setRoute('payment-method')"
          class="h-12 min-w-[240px] bg-primary text-on-primary rounded-xl flex items-center justify-between px-5 shadow-md hover:shadow-lg hover:bg-primary/90 transition-all active:scale-[0.98] ${itemCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
          ${itemCount === 0 ? 'disabled' : ''}
        >
          <span class="font-headline-md text-base font-bold tracking-wide">Proceed to Payment</span>
          <div class="w-7 h-7 bg-on-primary/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <span class="material-symbols-outlined text-on-primary text-[17px]">arrow_forward</span>
          </div>
        </button>
      </div>
    </div>
  </div>
  `;
}

// ==========================================
// SCREEN 1.5: BUSINESS ANALYTICS & EARNINGS DASHBOARD
// ==========================================

function renderAnalyticsView() {
  const totalRevenue = pos.getTotalRevenue();
  const totalInvested = pos.getTotalInvested();
  const inventoryAssetVal = pos.getTotalInventoryValue();
  const inventoryRetailVal = pos.getTotalInventoryRetailValue();
  const cogs = pos.getEstimatedCOGS();
  const grossProfit = pos.getNetGrossProfit();
  const ordersCount = pos.orders.length;
  const aov = ordersCount > 0 ? (totalRevenue / ordersCount) : 0;
  const totalItemsCount = pos.products.reduce((s, p) => s + (p.stock || 0), 0);
  const lowStockCount = pos.products.filter(p => (p.stock || 0) < 10).length;
  const totalTax = pos.orders.reduce((sum, o) => sum + (o.tax || 0), 0);
  const totalDiscount = pos.orders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const netSalesExTax = Math.max(0, totalRevenue - totalTax);

  // Category sales breakdown
  const categorySales = {};
  pos.categories.forEach(c => { if (c !== "All Items") categorySales[c] = 0; });
  pos.orders.forEach(ord => {
    ord.items.forEach(it => {
      const prod = pos.products.find(p => p.id === it.productId);
      const cat = prod ? prod.category : "Beverages";
      categorySales[cat] = (categorySales[cat] || 0) + (it.price * it.qty);
    });
  });

  // Payment Breakdown
  let upiSales = 0, cashSales = 0, splitSales = 0;
  pos.orders.forEach(ord => {
    if (ord.paymentMethod.includes("UPI") || ord.paymentMethod.includes("Digital")) upiSales += ord.total;
    else if (ord.paymentMethod.includes("Cash")) cashSales += ord.total;
    else splitSales += ord.total;
  });

  return `
  <div class="flex flex-col w-full h-[calc(100vh-64px)] p-3 sm:p-margin-edge pb-24 md:pb-6 overflow-y-auto animate-screen-enter select-none">
    
    <!-- Top Action & Title Bar -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="font-headline-lg text-lg sm:text-headline-lg text-on-surface font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px] sm:text-[28px]">query_stats</span>
          Business Performance & Earnings Dashboard
        </h1>
        <span class="font-label-bold text-xs bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-bold">
          Live Financial Health
        </span>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <button 
          onclick="openInvestmentModal()"
          class="h-11 px-5 w-full sm:w-auto rounded-xl bg-primary text-on-primary font-label-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95"
        >
          <span class="material-symbols-outlined text-[20px]">add_circle</span>
          + Log Investment / Expense
        </button>
      </div>
    </div>

    <!-- 4 Key Financial Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 shrink-0">
      
      <!-- Card 1: Total Gross Earnings -->
      <div class="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="font-label-bold text-xs text-on-surface-variant font-bold uppercase tracking-wider">Total Sales (Gross)</span>
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[22px]">trending_up</span>
          </div>
        </div>
        <div class="mt-3">
          <span class="font-display-price text-[28px] font-bold text-on-surface">${pos.settings.currency}${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <div class="flex items-center justify-between text-xs text-on-surface-variant mt-1 font-medium">
            <span>${ordersCount} Bills Completed</span>
            <span class="text-secondary font-bold">AOV: ${pos.settings.currency}${aov.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <!-- Card 2: Total Capital Invested -->
      <div class="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="font-label-bold text-xs text-on-surface-variant font-bold uppercase tracking-wider">Capital Invested</span>
          <div class="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
            <span class="material-symbols-outlined text-[22px]">account_balance</span>
          </div>
        </div>
        <div class="mt-3">
          <span class="font-display-price text-[28px] font-bold text-tertiary">${pos.settings.currency}${totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <div class="flex items-center justify-between text-xs text-on-surface-variant mt-1 font-medium">
            <span>${pos.investments.length} Expense Logs</span>
            <span class="text-tertiary font-bold">${pos.investments.length > 0 ? 'Active Ledger' : 'No Expenses Yet'}</span>
          </div>
        </div>
      </div>

      <!-- Card 3: Inventory Asset Value -->
      <div class="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="font-label-bold text-xs text-on-surface-variant font-bold uppercase tracking-wider">Inventory Stock Value</span>
          <div class="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
            <span class="material-symbols-outlined text-[22px]">inventory_2</span>
          </div>
        </div>
        <div class="mt-3">
          <span class="font-display-price text-[28px] font-bold text-secondary">${pos.settings.currency}${inventoryAssetVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <div class="flex items-center justify-between text-xs text-on-surface-variant mt-1 font-medium">
            <span>${totalItemsCount} Units in Stock</span>
            <span class="${lowStockCount > 0 ? 'text-error font-bold' : 'text-on-surface-variant'}">${lowStockCount} Low Stock</span>
          </div>
        </div>
      </div>

      <!-- Card 4: Gross Trading Profit -->
      <div class="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="font-label-bold text-xs text-on-surface-variant font-bold uppercase tracking-wider">Gross Trading Profit</span>
          <div class="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[22px]">monetization_on</span>
          </div>
        </div>
        <div class="mt-3">
          <span class="font-display-price text-[28px] font-bold text-primary">${pos.settings.currency}${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <div class="flex items-center justify-between text-xs text-on-surface-variant mt-1 font-medium">
            <span>Est. Margin: <strong>${totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0'}%</strong></span>
            <span class="text-secondary font-bold">${totalRevenue > 0 ? (grossProfit > 0 ? 'Profitable' : 'Breakeven') : 'Live Calculation'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Split: Left (60%) Investments & Financial Audit | Right (40%) Sales Breakdowns -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-6">
      
      <!-- Left Column (7/12) -->
      <div class="col-span-1 lg:col-span-7 flex flex-col gap-5">
        
        <!-- Section: Investment & Capital Tracker with Edit & Delete -->
        <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-tertiary text-[22px]">payments</span>
              <h2 class="font-headline-md text-base font-bold text-on-surface">Capital Investments & Expenses</h2>
            </div>
            <button onclick="openInvestmentModal()" class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">add</span> Add Entry
            </button>
          </div>

          <div class="overflow-x-auto max-h-64 overflow-y-auto pr-1">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-surface-container text-on-surface-variant font-bold sticky top-0">
                <tr>
                  <th class="p-2.5 rounded-l-lg">Date</th>
                  <th class="p-2.5">Title / Description</th>
                  <th class="p-2.5">Category</th>
                  <th class="p-2.5 text-right">Amount</th>
                  <th class="p-2.5 text-center rounded-r-lg">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/20 text-on-surface">
                ${pos.investments.length === 0 ? `
                  <tr>
                    <td colspan="5" class="py-8 text-center text-on-surface-variant">
                      <span class="material-symbols-outlined text-[32px] opacity-40">account_balance_wallet</span>
                      <p class="font-bold text-xs mt-1">No Capital Investments or Expenses Logged</p>
                      <p class="text-[11px] opacity-75 mt-0.5">Click "+ Add Entry" to record equipment purchases, raw material costs, or store setup.</p>
                    </td>
                  </tr>
                ` : pos.investments.map(inv => `
                  <tr class="hover:bg-surface-container/40 transition-colors">
                    <td class="p-2.5 text-on-surface-variant">${inv.date}</td>
                    <td class="p-2.5 font-bold">${inv.title}</td>
                    <td class="p-2.5">
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container-high text-on-surface">
                        ${inv.category}
                      </span>
                    </td>
                    <td class="p-2.5 text-right font-bold text-tertiary">${pos.settings.currency}${inv.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td class="p-2.5 text-center">
                      <div class="flex items-center justify-center gap-1.5">
                        <button onclick="openInvestmentModal('${inv.id}')" class="p-1 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-primary transition-colors active:scale-95" title="Edit Entry">
                          <span class="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                        <button onclick="confirmDeleteInvestment('${inv.id}')" class="p-1 rounded-lg bg-error/10 hover:bg-error hover:text-on-error text-error transition-colors active:scale-95" title="Delete Entry">
                          <span class="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section: Financial Breakdown & Cost Analytics -->
        <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-secondary text-[22px]">receipt_long</span>
              <h2 class="font-headline-md text-base font-bold text-on-surface">Financial Audit & Cost Breakdown</h2>
            </div>
            <span class="text-xs text-on-surface-variant font-medium">Catalog Retail: <strong>${pos.settings.currency}${inventoryRetailVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3 bg-surface-container rounded-xl flex flex-col">
              <span class="text-[11px] text-on-surface-variant font-bold uppercase">Net Sales (Ex Tax)</span>
              <span class="font-headline-md font-bold text-on-surface text-base mt-1">${pos.settings.currency}${netSalesExTax.toFixed(2)}</span>
            </div>
            <div class="p-3 bg-surface-container rounded-xl flex flex-col">
              <span class="text-[11px] text-on-surface-variant font-bold uppercase">GST Tax Collected</span>
              <span class="font-headline-md font-bold text-primary text-base mt-1">${pos.settings.currency}${totalTax.toFixed(2)}</span>
            </div>
            <div class="p-3 bg-surface-container rounded-xl flex flex-col">
              <span class="text-[11px] text-on-surface-variant font-bold uppercase">Discounts Given</span>
              <span class="font-headline-md font-bold text-tertiary text-base mt-1">${pos.settings.currency}${totalDiscount.toFixed(2)}</span>
            </div>
            <div class="p-3 bg-surface-container rounded-xl flex flex-col">
              <span class="text-[11px] text-on-surface-variant font-bold uppercase">Estimated COGS</span>
              <span class="font-headline-md font-bold text-secondary text-base mt-1">${pos.settings.currency}${cogs.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Right Column (5/12) Visual Breakdowns -->
      <div class="col-span-1 lg:col-span-5 flex flex-col gap-5">
        
        <!-- Payment Mode Breakdown -->
        <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
            <h3 class="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">donut_large</span>
              Payment Mode Collection
            </h3>
          </div>

          ${totalRevenue === 0 ? `
            <div class="py-8 text-center text-on-surface-variant flex flex-col items-center justify-center gap-1.5 opacity-60">
              <span class="material-symbols-outlined text-[32px]">donut_large</span>
              <p class="text-xs font-bold">No Payments Recorded Yet</p>
              <p class="text-[11px]">Payment breakdowns (UPI, Cash, Split) will show here in real-time as sales happen.</p>
            </div>
          ` : `
            <div class="flex flex-col gap-3">
              <!-- UPI / Digital -->
              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-xs font-bold">
                  <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-primary inline-block"></span> UPI & Digital</span>
                  <span>${pos.settings.currency}${upiSales.toFixed(2)} (${totalRevenue > 0 ? ((upiSales / totalRevenue) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div class="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                  <div class="h-full bg-primary rounded-full" style="width: ${totalRevenue > 0 ? (upiSales / totalRevenue) * 100 : 0}%;"></div>
                </div>
              </div>

              <!-- Cash -->
              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-xs font-bold">
                  <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-secondary inline-block"></span> Cash Tender</span>
                  <span>${pos.settings.currency}${cashSales.toFixed(2)} (${totalRevenue > 0 ? ((cashSales / totalRevenue) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div class="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                  <div class="h-full bg-secondary rounded-full" style="width: ${totalRevenue > 0 ? (cashSales / totalRevenue) * 100 : 0}%;"></div>
                </div>
              </div>

              <!-- Split -->
              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-xs font-bold">
                  <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-tertiary inline-block"></span> Split Payments</span>
                  <span>${pos.settings.currency}${splitSales.toFixed(2)} (${totalRevenue > 0 ? ((splitSales / totalRevenue) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div class="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                  <div class="h-full bg-tertiary rounded-full" style="width: ${totalRevenue > 0 ? (splitSales / totalRevenue) * 100 : 0}%;"></div>
                </div>
              </div>
            </div>
          `}
        </div>

        <!-- Sales by Category -->
        <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
            <h3 class="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-secondary text-[20px]">category</span>
              Sales by Menu Category
            </h3>
          </div>

          ${totalRevenue === 0 ? `
            <div class="py-8 text-center text-on-surface-variant flex flex-col items-center justify-center gap-1.5 opacity-60">
              <span class="material-symbols-outlined text-[32px]">category</span>
              <p class="text-xs font-bold">No Category Sales Yet</p>
              <p class="text-[11px]">Real-time category breakdown will show here as sales happen.</p>
            </div>
          ` : `
            <div class="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
              ${Object.keys(categorySales).map(cat => {
                const amount = categorySales[cat];
                const pct = totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(0) : 0;
                return `
                  <div class="flex flex-col gap-1">
                    <div class="flex justify-between text-xs">
                      <span class="font-bold text-on-surface">${cat}</span>
                      <span class="font-semibold text-on-surface-variant">${pos.settings.currency}${amount.toFixed(2)} (${pct}%)</span>
                    </div>
                    <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div class="h-full bg-primary-container rounded-full" style="width: ${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Live Terminal Station Info -->
        <div class="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4 flex flex-col gap-2 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="font-label-bold text-xs text-on-surface-variant font-bold uppercase">Terminal & Register Info</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">Active</span>
          </div>
          <div class="flex justify-between text-xs text-on-surface">
            <span>Store / Terminal:</span>
            <strong class="text-primary">${pos.settings.storeName} · ${pos.settings.terminal || 'Terminal #01'}</strong>
          </div>
          <div class="flex justify-between text-xs text-on-surface">
            <span>Cash in Drawer:</span>
            <strong class="text-secondary">${pos.settings.currency}${(pos.drawer.currentBalance || 0).toFixed(2)}</strong>
          </div>
        </div>

      </div>
    </div>
  </div>
  `;
}

// ==========================================
// MODAL: ADD / EDIT INVESTMENT & EXPENSE
// ==========================================

function openInvestmentModal(invId = null) {
  const inv = invId ? pos.investments.find(i => i.id === invId) : null;
  const isEdit = !!inv;

  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 animate-fade-in-up border border-outline-variant/30 my-auto">
      
      <div class="flex justify-between items-center pb-2 border-b border-outline-variant/20">
        <h3 class="font-headline-lg text-lg font-bold text-on-surface flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">${isEdit ? 'edit_note' : 'account_balance_wallet'}</span>
          ${isEdit ? 'Edit Capital Investment / Expense' : 'Log Capital Investment / Expense'}
        </h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Expense Title / Item *</label>
          <input id="inv-title-input" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. Coffee Beans Batch, Espresso Machine, Furniture..." value="${isEdit ? inv.title : ''}" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Amount (${pos.settings.currency}) *</label>
            <input id="inv-amount-input" type="number" step="100" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary font-bold" placeholder="5000" value="${isEdit ? inv.amount : ''}" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Category</label>
            <select id="inv-category-select" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary">
              <option value="Raw Material" ${isEdit && inv.category === 'Raw Material' ? 'selected' : ''}>Raw Material / Stock</option>
              <option value="Equipment" ${isEdit && inv.category === 'Equipment' ? 'selected' : ''}>Machinery & Equipment</option>
              <option value="Store Setup" ${isEdit && inv.category === 'Store Setup' ? 'selected' : ''}>Store Setup & Furniture</option>
              <option value="Packaging" ${isEdit && inv.category === 'Packaging' ? 'selected' : ''}>Packaging & Disposables</option>
              <option value="Operations" ${isEdit && inv.category === 'Operations' ? 'selected' : ''}>Operations & Utilities</option>
            </select>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Date of Investment</label>
          <input id="inv-date-input" type="date" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${isEdit ? inv.date : new Date().toISOString().slice(0, 10)}" />
        </div>
      </div>

      <div class="flex gap-3 pt-2 border-t border-outline-variant/20">
        <button onclick="closeModal()" class="flex-1 h-11 rounded-xl border border-outline-variant font-label-bold text-on-surface">Cancel</button>
        <button id="save-inv-btn" class="flex-1 h-11 rounded-xl bg-primary text-on-primary font-label-bold shadow-md hover:bg-primary/90 active:scale-95">${isEdit ? 'Update Entry' : 'Save Entry'}</button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  document.getElementById("save-inv-btn")?.addEventListener("click", () => {
    const title = document.getElementById("inv-title-input").value.trim();
    const amount = parseFloat(document.getElementById("inv-amount-input").value) || 0;
    const category = document.getElementById("inv-category-select").value;
    const date = document.getElementById("inv-date-input").value;

    if (!title || amount <= 0) {
      showToast("Please enter valid expense title and amount", "error", "error");
      return;
    }

    if (isEdit) {
      pos.updateInvestment(invId, { title, amount, category, date });
      closeModal();
      showToast(`Updated expense "${title}"`, "success", "check");
    } else {
      pos.addInvestment({ title, amount, category, date });
      closeModal();
      showToast(`Logged ₹${amount.toLocaleString('en-IN')} under ${category}`, "success", "check");
    }
  });
}

function openAddInvestmentModal() {
  openInvestmentModal(null);
}

function confirmDeleteInvestment(invId) {
  if (confirm("Delete this investment/expense record?")) {
    pos.deleteInvestment(invId);
    showToast("Investment entry removed", "info", "delete");
  }
}

// ==========================================
// SCREEN 2: PRODUCT & CATALOG MANAGER VIEW
// ==========================================

function renderProductsManagerView() {
  const filteredProducts = pos.products.filter(p => {
    const matchesCategory = pos.productManagerFilter === "All Items" || p.category === pos.productManagerFilter;
    const matchesSearch = !pos.productManagerSearch || p.name.toLowerCase().includes(pos.productManagerSearch.toLowerCase()) || p.sku.toLowerCase().includes(pos.productManagerSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return `
  <div class="flex flex-col w-full h-[calc(100vh-64px)] p-3 sm:p-margin-edge pb-24 md:pb-6 overflow-hidden animate-screen-enter">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="font-headline-lg text-lg sm:text-headline-lg text-on-surface font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px] sm:text-[28px]">inventory_2</span>
          Product Catalog & Menu Manager
        </h1>
        <span id="pm-total-count-badge" class="font-label-bold text-xs bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full">
          ${pos.products.length} Total Items
        </span>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap">
        <button 
          type="button"
          onclick="openShareMenuQRModal()"
          class="flex-1 sm:flex-none h-11 px-3 sm:px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-label-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
          title="Display QR code to scan from Phone 2"
        >
          <span class="material-symbols-outlined text-[18px]">qr_code_2</span>
          <span>Share (QR)</span>
        </button>
        <button 
          type="button"
          onclick="openImportMenuModal()"
          class="flex-1 sm:flex-none h-11 px-3 sm:px-3.5 rounded-xl border border-outline-variant bg-surface text-on-surface font-label-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-all active:scale-95"
          title="Paste code or import from Device 1"
        >
          <span class="material-symbols-outlined text-[18px]">file_download</span>
          <span>Import Menu</span>
        </button>
        <button 
          type="button"
          onclick="cloudSync.uploadAllData()"
          class="flex-1 sm:flex-none h-11 px-3 sm:px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
          title="Upload full menu to Cloud so other devices get it immediately"
        >
          <span class="material-symbols-outlined text-[18px]">cloud_upload</span>
          <span>Upload to Cloud</span>
        </button>
        <button 
          type="button"
          onclick="cloudSync.requestFullSync()"
          class="flex-1 sm:flex-none h-11 px-3 sm:px-3 rounded-xl border border-outline-variant bg-surface text-on-surface font-label-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-all active:scale-95"
          title="Download latest menu from Cloud"
        >
          <span class="material-symbols-outlined text-[18px]">cloud_download</span>
          <span>Pull from Cloud</span>
        </button>
        <button 
          type="button"
          onclick="openAddCategoryModal()"
          class="flex-1 sm:flex-none h-11 px-3 sm:px-3 rounded-xl border border-outline-variant bg-surface text-on-surface font-label-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors active:scale-95"
          title="Manage & Delete Categories"
        >
          <span class="material-symbols-outlined text-[18px]">category</span>
          Categories
        </button>
        <button 
          type="button"
          onclick="openProductModal()"
          class="flex-1 sm:flex-none h-11 px-3.5 sm:px-4 rounded-xl bg-primary text-on-primary font-label-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md hover:bg-primary/90 transition-all active:scale-95"
        >
          <span class="material-symbols-outlined text-[18px]">add_a_photo</span>
          Add Item
        </button>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 shrink-0 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
      <div class="relative w-full sm:w-80">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">search</span>
        </div>
        <input 
          id="pm-search-input"
          class="w-full h-10 pl-9 pr-3 rounded-xl bg-surface text-on-surface font-body-md text-sm placeholder-on-surface-variant outline-none focus:ring-2 focus:ring-primary border border-outline-variant/40"
          placeholder="Filter by name or SKU..."
          type="text"
          value="${pos.productManagerSearch}"
        />
      </div>

      <div id="pm-category-chips-container" class="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:max-w-[60%] pb-1 sm:pb-0">
        ${pos.categories.map(cat => `
          <button 
            class="pm-cat-chip shrink-0 h-9 px-3.5 rounded-xl text-xs font-label-bold transition-all ${pos.productManagerFilter === cat ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface text-on-surface hover:bg-surface-container-high border border-outline-variant/30'}"
            data-cat="${cat}"
          >
            ${cat}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto rounded-2xl bg-surface-container-low p-3 sm:p-4 border border-outline-variant/30">
      <div id="pm-products-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
        ${filteredProducts.length === 0 ? `
          ${pos.products.length === 0 ? `
            <div class="col-span-full py-16 flex flex-col items-center justify-center text-center text-on-surface-variant gap-3 bg-surface-container-lowest rounded-2xl border-2 border-dashed border-outline-variant/40 p-8 my-auto">
              <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-[36px]">add_a_photo</span>
              </div>
              <div class="flex flex-col gap-1">
                <h3 class="font-headline-md text-base font-bold text-on-surface">No Products in Catalog</h3>
                <p class="font-body-md text-xs text-on-surface-variant max-w-sm">Your catalog is completely clean. Click below to add your first menu item with custom price, photo, and modifiers.</p>
              </div>
              <button 
                onclick="openProductModal()"
                class="h-11 px-6 rounded-xl bg-primary text-on-primary font-headline-md text-xs flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95 mt-2"
              >
                <span class="material-symbols-outlined text-[18px]">add_circle</span>
                + Add First Product
              </button>
            </div>
          ` : `
            <div class="col-span-full flex flex-col items-center justify-center h-64 text-on-surface-variant gap-3">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant/50">inventory</span>
              <p class="font-headline-md font-semibold">No products found in this filter</p>
              <button onclick="openProductModal()" class="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-bold text-sm shadow-md active:scale-95">
                + Add New Product
              </button>
            </div>
          `}
        ` : filteredProducts.map((product, idx) => `
          <div 
            class="pm-draggable-card bg-surface-container-lowest rounded-2xl p-3 shadow-sm border border-outline-variant/30 flex flex-col justify-between hover:shadow-md transition-all group relative cursor-grab active:cursor-grabbing"
            draggable="true"
            data-pm-id="${product.id}"
            data-pm-index="${idx}"
          >
            <div class="w-full h-36 rounded-xl bg-surface-container relative overflow-hidden flex items-center justify-center mb-2.5">
              ${product.img ? `
                <img src="${product.img}" alt="${product.name}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <div class="w-full h-full hidden items-center justify-center" style="background-color: ${product.color || '#eff4ff'}">
                  <span class="material-symbols-outlined text-[36px] text-primary">${product.fallbackIcon || 'lunch_dining'}</span>
                </div>
              ` : `
                <div class="w-full h-full flex items-center justify-center" style="background-color: ${product.color || '#eff4ff'}">
                  <span class="material-symbols-outlined text-[40px] text-primary">${product.fallbackIcon || 'local_cafe'}</span>
                </div>
              `}
              
              <span class="absolute top-2 left-2 px-2 py-0.5 bg-inverse-surface/80 text-inverse-on-surface rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
                ${product.category}
              </span>

              ${product.isCombo ? `
                <span class="absolute top-2 right-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[9.5px] rounded-md shadow-md flex items-center gap-0.5 uppercase tracking-wider">
                  <span class="material-symbols-outlined text-[11px]">local_fire_department</span>
                  COMBO
                </span>
              ` : ''}

              <div class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs rounded text-white text-[10px] font-mono flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span class="material-symbols-outlined text-[11px]">drag_indicator</span>
                #${idx + 1}
              </div>
            </div>

            <div class="flex flex-col gap-1 mb-2">
              <div class="flex justify-between items-start">
                <h3 class="font-label-bold text-sm text-on-surface font-bold line-clamp-1">${product.name}</h3>
              </div>
              <div class="flex justify-between items-center text-xs text-on-surface-variant">
                <span>SKU: ${product.sku}</span>
                <span class="font-bold text-sm text-primary font-headline-md">${pos.settings.currency}${product.price.toFixed(2)}</span>
              </div>
              <div class="flex justify-between items-center text-[11px] text-on-surface-variant/80 mt-0.5">
                <span>Cost: ${pos.settings.currency}${(product.costPrice || product.price * 0.4).toFixed(2)}</span>
                <span class="px-2 py-0.5 rounded-full ${ (product.stock || 0) < 10 ? 'bg-error-container text-on-error-container font-bold' : 'bg-surface-container font-semibold' }">Stock: ${product.stock || 0}</span>
              </div>
              ${product.isCombo && product.comboItems && product.comboItems.length > 0 ? `
                <div class="text-[10px] text-amber-700 font-bold bg-amber-500/10 px-2 py-0.5 rounded mt-1 truncate">
                  Includes: ${product.comboItems.map(ci => `${ci.qty || 1}x ${ci.name}`).join(' + ')}
                </div>
              ` : ''}
            </div>

            <!-- Position Controls & Edit/Delete Actions -->
            <div class="flex items-center gap-1.5 pt-2 border-t border-outline-variant/20">
              <button 
                onclick="event.stopPropagation(); pos.reorderProduct('${product.id}', 'left');"
                class="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors active:scale-90 ${idx === 0 ? 'opacity-30 pointer-events-none' : ''}"
                title="Move Position Left / Up"
              >
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </button>
              
              <button 
                onclick="event.stopPropagation(); pos.reorderProduct('${product.id}', 'right');"
                class="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors active:scale-90 ${idx === filteredProducts.length - 1 ? 'opacity-30 pointer-events-none' : ''}"
                title="Move Position Right / Down"
              >
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>

              <button 
                onclick="openProductModal('${product.id}')"
                class="flex-1 h-8 rounded-lg bg-surface-container hover:bg-surface-variant text-primary font-label-bold text-xs flex items-center justify-center gap-1 transition-colors active:scale-95"
              >
                <span class="material-symbols-outlined text-[15px]">edit</span>
                Edit
              </button>
              
              <button 
                onclick="confirmDeleteProduct('${product.id}', '${escape(product.name)}')"
                class="w-8 h-8 rounded-lg bg-error-container/40 hover:bg-error-container text-on-error-container flex items-center justify-center transition-colors active:scale-95"
                title="Delete Product"
              >
                <span class="material-symbols-outlined text-[15px]">delete</span>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
  `;
}

// ==========================================
// SCREEN 3: PAYMENT METHOD SELECTION VIEW
// ==========================================

function renderPaymentMethodView() {
  const subtotal = pos.getSubtotal();
  const tax = pos.getTaxAmount();
  const total = pos.getTotalDue();
  const ticketNum = Math.floor(1000 + Math.random() * 9000);

  return `
  <div class="flex flex-col w-full h-[calc(100vh-64px)] overflow-y-auto p-3 sm:p-margin-edge pb-24 md:pb-12 animate-screen-enter select-none">
    <div class="flex flex-col lg:flex-row w-full gap-4 sm:gap-margin-edge">
      <section class="flex flex-col flex-1 lg:flex-[65] gap-4 sm:gap-stack-lg animate-fade-in-up">
        <div class="flex items-center gap-3 sm:gap-stack-md">
          <button 
            id="pay-back-dashboard-btn"
            class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-variant transition-colors shadow-sm active:scale-95 shrink-0"
          >
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="flex flex-col">
            <span class="font-label-sm text-xs sm:text-label-sm text-primary uppercase tracking-wider mb-0.5">Step 2 of 3</span>
            <h1 class="font-headline-lg text-lg sm:text-headline-lg text-on-surface m-0 font-bold">Select Payment Method</h1>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-gutter flex-1">
          <button 
            id="select-cash-pay-btn"
            class="group relative flex flex-col items-start p-4 sm:p-margin-edge rounded-2xl bg-surface-container-low shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden min-h-[150px] sm:min-h-[220px] text-left border-2 border-transparent hover:border-primary hover:bg-surface-container-high active:scale-[0.99]"
          >
            <div class="absolute top-0 right-0 w-32 h-32 bg-secondary-fixed/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center mb-auto shadow-sm">
              <span class="material-symbols-outlined text-[28px] sm:text-[36px] text-on-secondary-container">payments</span>
            </div>
            <div class="mt-4 sm:mt-stack-lg z-10 w-full">
              <h2 class="font-headline-md text-base sm:text-headline-md text-on-surface mb-0.5 sm:mb-1 font-bold">Cash (रुपये)</h2>
              <p class="font-body-md text-xs sm:text-body-md text-on-surface-variant opacity-80">Exact change or cash tender.</p>
              <div class="w-full h-1 bg-outline-variant/30 mt-2.5 sm:mt-3 rounded-full overflow-hidden">
                <div class="w-0 h-full bg-primary group-hover:w-full transition-all duration-500 ease-in-out"></div>
              </div>
            </div>
          </button>

          <button 
            id="select-digital-pay-btn"
            class="group relative flex flex-col items-start p-4 sm:p-margin-edge rounded-2xl bg-surface-container shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden min-h-[150px] sm:min-h-[220px] text-left border-2 border-transparent hover:border-primary active:scale-[0.99]"
          >
            <div class="absolute top-0 right-0 w-32 h-32 bg-primary-fixed/30 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center mb-auto shadow-sm">
              <span class="material-symbols-outlined text-[28px] sm:text-[36px] text-on-primary-container">qr_code_scanner</span>
            </div>
            <div class="mt-4 sm:mt-stack-lg z-10 w-full">
              <h2 class="font-headline-md text-base sm:text-headline-md text-on-surface mb-0.5 sm:mb-1 font-bold">UPI, QR & Card</h2>
              <div class="flex gap-2 mb-0.5 sm:mb-1 text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] sm:text-[20px]">contactless</span>
                <span class="material-symbols-outlined text-[18px] sm:text-[20px]">qr_code_2</span>
              </div>
              <p class="font-body-md text-xs sm:text-body-md text-on-surface-variant opacity-80">GPay, PhonePe, Paytm, or EMV Cards.</p>
              <div class="w-full h-1 bg-outline-variant/30 mt-2.5 sm:mt-3 rounded-full overflow-hidden">
                <div class="w-0 h-full bg-primary group-hover:w-full transition-all duration-500 ease-in-out"></div>
              </div>
            </div>
          </button>

          <button 
            id="select-split-pay-btn"
            class="group relative flex flex-col items-start p-4 sm:p-margin-edge rounded-2xl bg-surface-container-high shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden min-h-[130px] sm:min-h-[190px] text-left border-2 border-transparent hover:border-primary col-span-1 sm:col-span-2 active:scale-[0.99]"
          >
            <div class="absolute top-0 right-0 w-64 h-full bg-tertiary-container/10 skew-x-[-20deg] transition-transform group-hover:translate-x-8"></div>
            <div class="flex w-full justify-between items-start mb-auto">
              <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center shadow-sm">
                <span class="material-symbols-outlined text-[28px] sm:text-[36px] text-on-tertiary-container">call_split</span>
              </div>
              <div class="flex items-center gap-2 opacity-60">
                <span class="material-symbols-outlined text-[18px] sm:text-[20px] text-on-surface">payments</span>
                <div class="w-4 h-[2px] bg-outline-variant"></div>
                <span class="material-symbols-outlined text-[18px] sm:text-[20px] text-on-surface">qr_code_2</span>
              </div>
            </div>
            <div class="mt-3 sm:mt-stack-md z-10 w-full flex justify-between items-end">
              <div>
                <h2 class="font-headline-md text-base sm:text-headline-md text-on-surface mb-0.5 sm:mb-1 font-bold">Split Payment</h2>
                <p class="font-body-md text-xs sm:text-body-md text-on-surface-variant opacity-80 max-w-[85%] sm:max-w-[70%]">Combine cash and UPI/cards for this transaction.</p>
              </div>
              <span class="material-symbols-outlined text-primary text-[26px] sm:text-[32px] transform group-hover:translate-x-2 transition-transform">arrow_forward</span>
            </div>
          </button>
        </div>
      </section>

      <aside class="flex flex-col w-full lg:w-auto lg:flex-[35] bg-surface-container-lowest rounded-2xl shadow-sm lg:shadow-xl overflow-hidden animate-slide-right border border-outline-variant/30 shrink-0">
        <div class="bg-surface-container p-3 sm:p-margin-edge flex justify-between items-center relative overflow-hidden border-b border-outline-variant/30">
          <div>
            <h3 class="font-label-bold text-xs sm:text-label-bold text-on-surface uppercase tracking-wider mb-0.5">Current Order</h3>
            <p class="font-label-sm text-xs text-on-surface-variant">Ticket #${ticketNum}</p>
          </div>
          <div class="w-9 h-9 sm:w-10 sm:h-10 bg-surface rounded-full flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-on-surface text-[20px]">receipt_long</span>
          </div>
        </div>

        <div class="p-3 sm:p-margin-edge flex-1 flex flex-col relative">
          <div class="absolute top-0 left-0 w-full h-2 flex z-10 receipt-wave-edge"></div>

          <div class="flex-1 space-y-2 sm:space-y-stack-md mt-4 relative z-0 overflow-y-auto max-h-56 lg:max-h-[calc(100vh-380px)] pr-1">
            ${pos.cart.map(item => `
              <div class="flex justify-between items-start pb-2 sm:pb-stack-sm border-b border-outline-variant/30 border-dashed">
                <div class="pr-2">
                  <p class="font-body-md text-sm text-on-surface font-semibold">${item.name}</p>
                  <p class="font-label-sm text-xs text-on-surface-variant">${item.qty} x ${pos.settings.currency}${item.price.toFixed(2)} (${item.modifier || 'Standard'})</p>
                </div>
                <p class="font-body-md text-sm text-on-surface font-medium shrink-0">${pos.settings.currency}${(item.price * item.qty).toFixed(2)}</p>
              </div>
            `).join('')}
          </div>

          <div class="mt-auto pt-3 sm:pt-margin-edge">
            <div class="flex justify-between items-center mb-1 text-on-surface-variant font-label-sm text-xs">
              <span>Subtotal</span>
              <span class="text-on-surface font-body-md font-semibold">${pos.settings.currency}${subtotal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center mb-2.5 sm:mb-3 text-on-surface-variant font-label-sm text-xs">
              <span>${(pos.settings.taxRate === 0 || !pos.settings.taxRate) ? 'Tax (0% Exempt)' : `GST (${pos.settings.taxRate}%)`}</span>
              <span class="text-on-surface font-body-md font-semibold">${pos.settings.currency}${tax.toFixed(2)}</span>
            </div>
            <div class="bg-primary text-on-primary rounded-2xl p-3 sm:p-stack-md flex justify-between items-center relative overflow-hidden shadow-lg">
              <span class="font-headline-lg text-lg sm:text-headline-lg text-on-primary font-bold">Total</span>
              <span class="font-display-price text-2xl sm:text-display-price text-on-primary font-bold">${pos.settings.currency}${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
  `;
}

// ==========================================
// SCREEN 4: CASH & CHANGE CALCULATOR VIEW (INR NOTES)
// ==========================================

function renderCalculationView() {
  const total = pos.getTotalDue();
  const received = parseFloat(pos.calcInput) || 0;
  const change = received - total;

  const exactAmt = total.toFixed(2);
  const next100 = (Math.ceil(total / 100) * 100 || 100).toFixed(2);
  const next500 = (Math.ceil(total / 500) * 500 || 500).toFixed(2);
  const next2000 = (Math.ceil(total / 2000) * 2000 || 2000).toFixed(2);

  const quickAmounts = [
    { label: "Exact", val: exactAmt },
    { label: `${pos.settings.currency}${next100}`, val: next100 },
    { label: `${pos.settings.currency}${next500}`, val: next500 },
    { label: `${pos.settings.currency}${next2000}`, val: next2000 }
  ];

  return `
  <div class="flex flex-col w-full h-[calc(100vh-64px)] overflow-y-auto bg-background animate-screen-enter select-none pb-24 lg:pb-0">
    <div class="flex-1 flex flex-col lg:flex-row p-3 sm:p-margin-edge gap-4 sm:gap-margin-edge">
      <div class="flex flex-col w-full lg:w-[60%] justify-between gap-4">
        <div class="flex flex-col gap-3 sm:gap-stack-lg">
          <div class="flex flex-col gap-stack-sm">
            <div class="flex items-center gap-3">
              <button 
                id="calc-back-btn"
                class="w-10 h-10 sm:w-touch-target-min sm:h-touch-target-min flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-95 shrink-0"
              >
                <span class="material-symbols-outlined">arrow_back</span>
              </button>
              <h1 class="font-headline-lg text-lg sm:text-headline-lg text-on-surface font-bold">Payment Details</h1>
            </div>
          </div>

          <div class="flex flex-col gap-3 sm:gap-gutter bg-surface-container-low rounded-2xl p-4 sm:p-stack-lg shadow-sm border border-outline-variant/30">
            <div class="flex justify-between items-end pb-3 sm:pb-stack-md border-b-[1px] border-outline-variant/30">
              <span class="font-body-md sm:font-body-lg text-sm sm:text-body-lg text-on-surface-variant">Total Due</span>
              <span class="font-display-price text-2xl sm:text-display-price text-on-surface font-bold">${pos.settings.currency}${total.toFixed(2)}</span>
            </div>

            <div class="flex flex-col gap-1.5 sm:gap-stack-sm pt-2 sm:pt-stack-sm relative group">
              <label class="font-label-bold text-xs sm:text-label-bold text-on-surface-variant font-semibold">Cash Tendered</label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 sm:left-stack-md font-headline-lg text-lg sm:text-headline-lg text-on-surface-variant">${pos.settings.currency}</span>
                <input 
                  id="amount-received-input"
                  class="w-full h-[58px] sm:h-[72px] pl-[38px] sm:pl-[48px] pr-10 sm:pr-touch-target-min bg-surface rounded-xl font-display-price text-[28px] sm:text-[40px] leading-tight font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-right cursor-default shadow-inner" 
                  readonly="" 
                  type="text" 
                  value="${pos.calcInput}"
                />
                <button 
                  id="calc-clear-input-btn"
                  class="absolute right-2 sm:right-stack-sm w-9 h-9 sm:w-touch-target-min sm:h-touch-target-min flex items-center justify-center text-on-surface-variant hover:text-error transition-colors rounded-full"
                >
                  <span class="material-symbols-outlined text-[20px]">cancel</span>
                </button>
              </div>
            </div>

            <div class="flex justify-between items-end pt-3 sm:pt-stack-md mt-1 sm:mt-stack-sm border-t-[1px] border-outline-variant/30">
              <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-stack-sm">
                <span class="font-headline-md text-sm sm:text-headline-md text-on-surface font-semibold">Change to Return</span>
                <div id="calc-change-badge-container">
                  ${change >= 0 ? `
                    <div class="h-5 sm:h-6 px-2.5 sm:px-3 rounded-full bg-secondary-container flex items-center justify-center">
                      <span class="font-label-sm text-[11px] sm:text-xs text-on-secondary-container font-bold">Due to Customer</span>
                    </div>
                  ` : `
                    <div class="h-5 sm:h-6 px-2.5 sm:px-3 rounded-full bg-error-container flex items-center justify-center">
                      <span class="font-label-sm text-[11px] sm:text-xs text-on-error-container font-bold">Insufficient</span>
                    </div>
                  `}
                </div>
              </div>
              <span id="calc-change-display" class="font-display-price text-[32px] sm:text-[54px] leading-tight font-bold ${change >= 0 ? 'text-secondary' : 'text-error'}">
                ${change >= 0 ? `${pos.settings.currency}${change.toFixed(2)}` : `-${pos.settings.currency}${Math.abs(change).toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>

        <div class="hidden sm:flex flex-1 mt-stack-md relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm items-center justify-center border border-outline-variant/30">
          <div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5"></div>
          <div class="relative flex flex-col items-center gap-2 text-center p-stack-md z-10">
            <div class="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center shadow-md">
              <span class="material-symbols-outlined text-[24px] text-on-primary-container">point_of_sale</span>
            </div>
            <p class="font-body-md text-xs text-on-surface-variant max-w-[85%]">
              Verify exact change before confirming the transaction to maintain cash drawer balance.
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-col w-full lg:w-[40%] gap-3 sm:gap-stack-md">
        <div class="grid grid-cols-4 gap-2">
          ${quickAmounts.map(q => `
            <button 
              class="quick-amt-btn h-11 sm:h-13 py-2 sm:py-3 rounded-xl bg-surface-container hover:bg-primary hover:text-on-primary font-headline-md text-xs sm:text-sm font-bold text-on-surface transition-colors shadow-sm active:scale-95" 
              data-val="${q.val}"
            >
              ${q.label}
            </button>
          `).join('')}
        </div>

        <div class="grid grid-cols-3 gap-2 bg-surface-container-low p-2.5 sm:p-3 rounded-2xl shadow-sm border border-outline-variant/30">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map(num => `
            <button 
              class="numpad-key-btn w-full h-14 sm:h-full min-h-[52px] sm:min-h-[64px] bg-surface rounded-xl font-headline-lg text-2xl sm:text-[26px] font-bold text-on-surface hover:bg-surface-variant hover:text-primary transition-all shadow-sm active:scale-95" 
              data-val="${num}"
            >
              ${num}
            </button>
          `).join('')}
          
          <button 
            id="numpad-backspace-btn"
            class="w-full h-14 sm:h-full min-h-[52px] sm:min-h-[64px] bg-surface-container rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-all shadow-sm active:scale-95"
          >
            <span class="material-symbols-outlined text-[24px] sm:text-[28px]">backspace</span>
          </button>
        </div>
      </div>
    </div>

    <div class="h-auto py-3 sm:h-20 w-full bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.05)] px-4 sm:px-margin-edge flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 z-20 border-t border-outline-variant/30">
      <div class="flex items-center justify-between sm:justify-start gap-4 sm:gap-stack-lg">
        <div class="flex flex-col">
          <span class="font-label-sm text-[10px] sm:text-label-sm text-on-surface-variant uppercase tracking-wider">Method</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="material-symbols-outlined text-primary text-[18px]">payments</span>
            <span class="font-headline-md text-sm sm:text-headline-md text-on-surface font-bold">Cash (₹)</span>
          </div>
        </div>
        <div class="w-[1px] h-8 bg-outline-variant/50"></div>
        <div class="flex flex-col">
          <span class="font-label-sm text-[10px] sm:text-label-sm text-on-surface-variant uppercase tracking-wider">Cash Drawer</span>
          <span class="font-body-md text-xs sm:text-body-md text-secondary mt-0.5 flex items-center gap-1 font-bold">
            <span class="material-symbols-outlined text-[15px] text-secondary">check_circle</span> Open & Ready
          </span>
        </div>
      </div>

      <button 
        id="confirm-cash-payment-btn"
        class="w-full sm:w-[40%] h-[50px] sm:h-[56px] bg-primary hover:bg-primary/90 text-on-primary rounded-xl font-headline-md sm:font-headline-lg text-base sm:text-headline-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${change < 0 ? 'opacity-50 cursor-not-allowed' : ''}"
        ${change < 0 ? 'disabled' : ''}
      >
        <span class="material-symbols-outlined text-[20px] sm:text-[24px]">task_alt</span>
        Confirm Payment
      </button>
    </div>
  </div>
  `;
}

// ==========================================
// SCREEN 5: ORDER CONFIRMATION VIEW
// ==========================================

function renderConfirmationView() {
  const activeOrder = pos.activeTransaction || pos.orders[0] || {
    receiptNumber: "MGN-882901",
    displayDate: new Date().toLocaleDateString('en-IN'),
    paymentMethod: "UPI & Digital",
    items: pos.cart,
    subtotal: pos.getSubtotal(),
    tax: pos.getTaxAmount(),
    total: pos.getTotalDue(),
    tenderDetails: { changeDue: 0.00 }
  };

  return `
  <div class="flex flex-col w-full h-[calc(100vh-64px)] overflow-y-auto pb-24 md:pb-6 animate-screen-enter select-none">
    <div class="flex flex-col-reverse lg:flex-row w-full flex-1 relative">
      <div class="w-full lg:w-[35%] flex flex-col bg-surface-container-lowest shadow-lg lg:shadow-2xl z-20 relative border-t lg:border-t-0 lg:border-r border-outline-variant/30 shrink-0">
        <div class="h-2 w-full bg-primary"></div>
        <div class="flex flex-col flex-1 p-4 sm:p-margin-edge">
          <div class="flex items-center justify-between mb-3 sm:mb-stack-lg">
            <div class="flex flex-col">
              <span class="font-label-bold text-xs sm:text-label-bold text-on-surface-variant uppercase tracking-wider">Receipt</span>
              <span class="font-headline-md text-base sm:text-headline-md text-on-surface font-bold">#${activeOrder.receiptNumber}</span>
            </div>
            <div class="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-surface-container flex items-center justify-center">
              <span class="material-symbols-outlined text-on-surface-variant text-[20px]">receipt_long</span>
            </div>
          </div>

          <div class="flex flex-col gap-2.5 sm:gap-3 flex-1 overflow-y-auto max-h-56 lg:max-h-[calc(100vh-360px)] pr-1">
            ${activeOrder.items.map(item => `
              <div class="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl hover:bg-surface-container-low transition-colors border border-outline-variant/20">
                <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-surface-variant overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <span class="material-symbols-outlined text-primary text-[18px] sm:text-[22px]">coffee</span>
                </div>
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="font-body-md text-xs sm:text-sm text-on-surface font-bold truncate">${item.name}</span>
                  <span class="font-label-sm text-[11px] sm:text-xs text-on-surface-variant">Qty: ${item.qty} · ${item.modifier || 'Standard'}</span>
                </div>
                <span class="font-label-bold text-xs sm:text-sm font-bold text-on-surface">${pos.settings.currency}${(item.price * item.qty).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>

          <div class="mt-4 sm:mt-stack-lg pt-3 sm:pt-gutter flex flex-col gap-1.5 relative border-t border-outline-variant/30">
            <div class="flex justify-between items-center text-xs sm:text-sm">
              <span class="text-on-surface-variant">Subtotal</span>
              <span class="font-bold text-on-surface">${pos.settings.currency}${activeOrder.subtotal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center text-xs sm:text-sm">
              <span class="text-on-surface-variant">${((activeOrder.taxRate !== undefined ? activeOrder.taxRate : pos.settings.taxRate) === 0) ? 'Tax (0% Exempt)' : `GST (${activeOrder.taxRate !== undefined ? activeOrder.taxRate : pos.settings.taxRate}%)`}</span>
              <span class="font-bold text-on-surface">${pos.settings.currency}${activeOrder.tax.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-outline-variant/30">
              <span class="font-headline-md text-sm sm:text-headline-md text-on-surface font-bold">Total</span>
              <span class="font-headline-md text-base sm:text-headline-md text-primary font-bold">${pos.settings.currency}${activeOrder.total.toFixed(2)}</span>
            </div>
            <div class="mt-2.5 sm:mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-secondary-container/20 rounded-xl">
              <span class="material-symbols-outlined text-secondary text-[16px] sm:text-[18px]">credit_card</span>
              <span class="font-label-sm text-[11px] sm:text-xs text-on-secondary-container font-bold">Paid via ${activeOrder.paymentMethod}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="w-full lg:w-[65%] flex flex-col items-center justify-center p-4 sm:p-stack-lg relative bg-surface py-8 lg:py-12">
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-secondary-container/30 rounded-full blur-[100px] pointer-events-none"></div>

        <div class="relative z-10 flex flex-col items-center text-center animate-fade-in-up max-w-lg w-full">
          <div class="relative w-20 h-20 sm:w-28 sm:h-28 mb-3 sm:mb-4 flex items-center justify-center">
            <div class="absolute inset-0 bg-secondary-container rounded-full animate-ping-custom opacity-20"></div>
            <div class="absolute inset-0 bg-secondary-container/50 rounded-full scale-75 animate-pulse-slow"></div>
            <div class="relative z-10 w-16 h-16 sm:w-20 sm:h-20 bg-secondary rounded-full flex items-center justify-center shadow-xl shadow-secondary/30">
              <span class="material-symbols-outlined text-on-secondary text-[32px] sm:text-[40px] font-bold">check</span>
            </div>
          </div>

          <h1 class="font-display-price text-2xl sm:text-[36px] font-bold text-on-surface mb-1.5 sm:mb-2">Order Confirmed!</h1>
          <div class="flex items-center gap-3 mb-2">
            <div class="px-4 py-2 bg-primary-container/40 rounded-xl border border-primary/30">
              <span class="font-label-bold text-[10px] text-on-surface-variant uppercase tracking-wider">Receipt</span>
              <p class="font-headline-md text-lg sm:text-xl font-bold text-primary">#${activeOrder.receiptNumber}</p>
            </div>
            ${activeOrder.kitchenToken ? `
            <div class="px-4 py-2 bg-secondary-container/40 rounded-xl border border-secondary/30">
              <span class="font-label-bold text-[10px] text-on-surface-variant uppercase tracking-wider">Token</span>
              <p class="font-headline-md text-lg sm:text-xl font-bold text-secondary">${activeOrder.kitchenToken}</p>
            </div>
            ` : ''}
          </div>
          <p class="font-body-md text-xs sm:text-sm text-on-surface-variant max-w-md mb-4 sm:mb-6">
            Transaction successfully processed. The digital receipt has been logged.
          </p>

          <div class="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full">
            <button 
              id="confirm-print-receipt-btn"
              class="w-full sm:flex-1 h-12 sm:h-14 flex items-center justify-center gap-2 bg-surface-variant text-on-surface rounded-xl hover:bg-surface-container-highest hover:shadow-md transition-all active:scale-95 font-bold text-sm"
            >
              <span class="material-symbols-outlined text-[18px]">print</span>
              <span>Print Receipt</span>
            </button>
            <button 
              id="confirm-new-order-btn"
              class="w-full sm:flex-1 h-12 sm:h-14 flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-fixed-variant hover:shadow-xl transition-all active:scale-95 font-bold text-sm"
            >
              <span class="material-symbols-outlined text-[18px]">add_circle</span>
              <span>New Order</span>
            </button>
          </div>

          <div class="mt-3 sm:mt-4 w-full bg-surface-container-lowest p-2 rounded-xl shadow-sm flex items-center gap-2 border border-outline-variant/30">
            <div class="flex items-center justify-center w-9 h-9 bg-surface-container rounded-lg text-on-surface-variant shrink-0">
              <span class="material-symbols-outlined text-[18px]">mail</span>
            </div>
            <input 
              id="receipt-email-input"
              class="flex-1 bg-transparent border-none outline-none font-body-md text-xs sm:text-sm text-on-surface placeholder:text-outline" 
              placeholder="Email receipt to customer..." 
              type="email"
            />
            <button 
              id="send-email-receipt-btn"
              class="h-9 px-3.5 sm:px-4 flex items-center justify-center bg-inverse-surface text-inverse-on-surface rounded-lg hover:bg-on-surface transition-colors active:scale-95 font-label-bold text-xs shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

// ==========================================
// SCREEN 6: ORDER HISTORY & RECEIPTS VIEW
// ==========================================

function renderHistoryView() {
  const orders = pos.orders;

  return `
  <div class="flex flex-col w-full h-[calc(100vh-64px)] p-3 sm:p-margin-edge pb-24 md:pb-6 overflow-hidden animate-screen-enter select-none">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-3">
        <h1 class="font-headline-lg text-lg sm:text-headline-lg text-on-surface font-bold">Order History & Receipts</h1>
        <span class="font-label-bold text-xs bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full">
          ${orders.length} Transactions
        </span>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <button 
          id="export-csv-btn"
          class="flex-1 sm:flex-none h-10 sm:h-11 px-3 sm:px-4 rounded-xl bg-surface-container text-on-surface font-label-bold flex items-center justify-center gap-1.5 hover:bg-surface-variant transition-colors border border-outline-variant/30 text-xs"
        >
          <span class="material-symbols-outlined text-[18px]">download</span>
          Export CSV
        </button>

        <button 
          onclick="openDeleteOrderHistoryModal()"
          class="flex-1 sm:flex-none h-10 sm:h-11 px-3 sm:px-4 rounded-xl bg-error/10 hover:bg-error hover:text-on-error text-error font-label-bold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 text-xs"
          title="Delete or Clear Order History"
        >
          <span class="material-symbols-outlined text-[18px]">delete_sweep</span>
          Delete Orders
        </button>
      </div>
    </div>

    <div class="flex-1 bg-surface-container-low rounded-2xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/30">
      ${orders.length === 0 ? `
        <div class="flex flex-col items-center justify-center flex-1 text-on-surface-variant gap-2 p-6">
          <span class="material-symbols-outlined text-[56px]">receipt_long</span>
          <p class="font-headline-md font-bold text-sm sm:text-base">No completed orders yet</p>
          <p class="font-body-md text-xs sm:text-sm text-center">Completed transactions will be saved locally here.</p>
        </div>
      ` : `
        <div class="flex-1 overflow-auto">
          <table class="w-full text-left border-collapse min-w-[620px]">
            <thead class="bg-surface-container sticky top-0 z-10 text-on-surface-variant font-label-bold text-xs uppercase tracking-wider">
              <tr>
                <th class="p-3 sm:p-4">Receipt #</th>
                <th class="p-3 sm:p-4">Date & Time</th>
                <th class="p-3 sm:p-4">Customer</th>
                <th class="p-3 sm:p-4">Items</th>
                <th class="p-3 sm:p-4">Payment</th>
                <th class="p-3 sm:p-4 text-right">Total (${pos.settings.currency})</th>
                <th class="p-3 sm:p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/30 text-on-surface font-body-md text-xs sm:text-sm">
              ${orders.map(order => `
                <tr class="hover:bg-surface-container transition-colors">
                  <td class="p-3 sm:p-4 font-bold text-primary">${order.receiptNumber}</td>
                  <td class="p-3 sm:p-4 text-on-surface-variant text-xs">${order.displayDate}</td>
                  <td class="p-3 sm:p-4 font-semibold">${order.customer?.name || 'Walk-in'}</td>
                  <td class="p-3 sm:p-4">${order.items.reduce((s, i) => s + i.qty, 0)} items</td>
                  <td class="p-3 sm:p-4">
                    <span class="px-2.5 py-1 bg-surface-container-high rounded-md text-xs font-bold">${order.paymentMethod}</span>
                  </td>
                  <td class="p-3 sm:p-4 text-right font-headline-md font-bold text-sm sm:text-base">${pos.settings.currency}${order.total.toFixed(2)}</td>
                  <td class="p-3 sm:p-4 text-center">
                    <div class="flex items-center justify-center gap-1.5 sm:gap-2">
                      <button 
                        class="history-print-btn p-1.5 sm:p-2 rounded-lg bg-surface hover:bg-primary hover:text-on-primary text-on-surface-variant transition-colors border border-outline-variant/30" 
                        data-receipt="${order.receiptNumber}" 
                        title="Print Receipt"
                      >
                        <span class="material-symbols-outlined text-[17px] sm:text-[18px]">print</span>
                      </button>
                      <button 
                        onclick="confirmDeleteSingleOrder('${order.id}', '${order.receiptNumber}')" 
                        class="p-1.5 sm:p-2 rounded-lg bg-surface hover:bg-error hover:text-on-error text-error transition-colors border border-outline-variant/30" 
                        title="Delete this Order"
                      >
                        <span class="material-symbols-outlined text-[17px] sm:text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  </div>
  `;
}

// ==========================================
// SCREEN 6B: KITCHEN DISPLAY SYSTEM (KDS) & KOT SCREEN
// ==========================================

function renderKitchenView() {
  const filter = pos.kitchenFilter || "all";
  const orders = pos.getActiveKitchenOrders(filter);
  const pendingCount = pos.orders.filter(o => o.kitchenStatus === "Pending").length;
  const preparingCount = pos.orders.filter(o => o.kitchenStatus === "Preparing").length;
  const readyCount = pos.orders.filter(o => o.kitchenStatus === "Ready").length;
  const servedCount = pos.orders.filter(o => o.kitchenStatus === "Served").length;

  return `
  <div class="flex flex-col w-full h-[calc(100vh-64px)] bg-surface-container-lowest animate-screen-enter select-none overflow-hidden">
    
    <!-- Top Kitchen Toolbar -->
    <div class="h-auto shrink-0 bg-surface px-3 sm:px-6 py-2.5 sm:py-0 sm:h-16 border-b border-outline-variant/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
      
      <!-- Left Title & Counters -->
      <div class="flex items-center justify-between md:justify-start gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs shrink-0">
            <span class="material-symbols-outlined text-[20px] sm:text-[24px]">soup_kitchen</span>
          </div>
          <div>
            <h1 class="font-headline-lg text-base sm:text-lg font-extrabold text-on-surface flex items-center gap-1.5 sm:gap-2">
              Kitchen Display (KDS)
              <span class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-primary text-on-primary font-bold">LIVE</span>
            </h1>
            <p class="text-[11px] sm:text-xs text-on-surface-variant font-medium hidden sm:block">Real-time Order Cooking & Preparation Board</p>
          </div>
        </div>

        <!-- Right Actions on Mobile: Sound Bell & Fullscreen -->
        <div class="flex md:hidden items-center gap-1.5">
          <button 
            onclick="playKitchenAudioChime()"
            class="h-8 px-2.5 rounded-lg border border-outline-variant/40 bg-surface hover:bg-surface-container text-on-surface text-xs font-label-bold flex items-center gap-1 shadow-xs active:scale-95"
            title="Test Audio Chime Bell"
          >
            <span class="material-symbols-outlined text-[15px] text-primary">notifications_active</span>
            <span>Chime</span>
          </button>
          <button 
            onclick="toggleKDSFullscreen()"
            class="h-8 w-8 rounded-lg bg-surface-container hover:bg-surface-container-highest text-on-surface flex items-center justify-center shadow-xs active:scale-95"
            title="Toggle Fullscreen"
          >
            <span class="material-symbols-outlined text-[16px]">fullscreen</span>
          </button>
        </div>
      </div>

      <!-- Status Filter Tabs (Horizontal Scrollable) -->
      <div class="flex items-center gap-1.5 bg-surface-container-high p-1 rounded-xl border border-outline-variant/30 overflow-x-auto no-scrollbar shrink-0">
        <button 
          onclick="setKitchenFilter('all')"
          class="kitchen-filter-tab px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-label-bold whitespace-nowrap transition-all shrink-0 ${filter === 'all' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface hover:bg-surface-variant'}"
        >
          All (${pendingCount + preparingCount + readyCount})
        </button>
        <button 
          onclick="setKitchenFilter('pending')"
          class="kitchen-filter-tab px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-label-bold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${filter === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 hover:bg-amber-500/10'}"
        >
          <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          New (${pendingCount})
        </button>
        <button 
          onclick="setKitchenFilter('preparing')"
          class="kitchen-filter-tab px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-label-bold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${filter === 'preparing' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-800 hover:bg-blue-500/10'}"
        >
          <span class="material-symbols-outlined text-[14px]">skillet</span>
          Cooking (${preparingCount})
        </button>
        <button 
          onclick="setKitchenFilter('ready')"
          class="kitchen-filter-tab px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-label-bold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${filter === 'ready' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800 hover:bg-emerald-500/10'}"
        >
          <span class="material-symbols-outlined text-[14px]">check_circle</span>
          Ready (${readyCount})
        </button>
        <button 
          onclick="setKitchenFilter('history')"
          class="kitchen-filter-tab px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-label-bold whitespace-nowrap transition-all shrink-0 text-on-surface-variant hover:bg-surface-variant ${filter === 'history' ? 'bg-surface text-on-surface font-bold shadow-xs' : ''}"
        >
          Recalls (${servedCount})
        </button>
      </div>

      <!-- Desktop Right Actions: Sound Bell, Fullscreen -->
      <div class="hidden md:flex items-center gap-2 shrink-0">
        <button 
          onclick="playKitchenAudioChime()"
          class="h-9 px-3 rounded-xl border border-outline-variant/40 bg-surface hover:bg-surface-container text-on-surface text-xs font-label-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
          title="Test Audio Chime Bell"
        >
          <span class="material-symbols-outlined text-[16px] text-primary">notifications_active</span>
          Test Bell
        </button>

        <button 
          onclick="toggleKDSFullscreen()"
          class="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface text-xs font-label-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
          title="Toggle Fullscreen Tablet Mode"
        >
          <span class="material-symbols-outlined text-[16px]">fullscreen</span>
          Fullscreen
        </button>
      </div>
    </div>

    <!-- Kitchen Orders Container -->
    <div id="kitchen-cards-container" class="flex-1 p-3 sm:p-5 pb-24 md:pb-5 overflow-y-auto">
      ${orders.length === 0 ? `
        <div class="h-full min-h-[380px] flex flex-col items-center justify-center text-center text-on-surface-variant gap-4 bg-surface-container-low/40 rounded-3xl border-2 border-dashed border-outline-variant/30 p-8 my-auto">
          <div class="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-[44px]">check_circle</span>
          </div>
          <div class="flex flex-col gap-1 max-w-md">
            <h3 class="font-headline-lg text-lg font-bold text-on-surface">All Orders Prepared!</h3>
            <p class="font-body-md text-xs text-on-surface-variant">
              No pending orders in this kitchen queue. Whenever an order is confirmed at the POS counter, it will pop up here with an automatic sound chime.
            </p>
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4.5 auto-rows-max">
          ${orders.map(order => renderKitchenOrderCard(order)).join('')}
        </div>
      `}
    </div>
  </div>
  `;
}

function renderKitchenOrderCard(order) {
  const isPending = order.kitchenStatus === "Pending";
  const isPreparing = order.kitchenStatus === "Preparing";
  const isReady = order.kitchenStatus === "Ready";
  const isServed = order.kitchenStatus === "Served";

  const orderTime = new Date(order.date || order.timestamp || Date.now()).getTime();
  const elapsedMinutes = Math.floor((Date.now() - orderTime) / 60000);
  const elapsedSeconds = Math.floor(((Date.now() - orderTime) % 60000) / 1000);
  const timeFormatted = `${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;

  let timerBadgeClass = "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (elapsedMinutes >= 10) {
    timerBadgeClass = "bg-error/20 text-error border-error/40 animate-pulse font-black";
  } else if (elapsedMinutes >= 5) {
    timerBadgeClass = "bg-amber-500/20 text-amber-800 border-amber-500/40 font-bold";
  }

  let cardBorderClass = "border-outline-variant/40";
  if (isPending) cardBorderClass = "border-amber-500/60 shadow-md ring-1 ring-amber-500/30";
  if (isPreparing) cardBorderClass = "border-blue-500/60 shadow-md ring-1 ring-blue-500/30";
  if (isReady) cardBorderClass = "border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30";

  return `
    <div 
      class="kitchen-kot-card flex flex-col bg-surface rounded-2xl overflow-hidden border ${cardBorderClass} shadow-sm hover:shadow-md transition-all h-[420px]"
      data-order-id="${order.id}"
    >
      <!-- Card Header -->
      <div class="px-4 py-3 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-display font-extrabold text-base text-on-surface">${order.kitchenToken || order.receiptNumber}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isPending ? 'bg-amber-500 text-white' : (isPreparing ? 'bg-blue-600 text-white' : (isReady ? 'bg-emerald-600 text-white' : 'bg-surface-container-highest text-on-surface-variant'))
          }">
            ${order.kitchenStatus || 'Pending'}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <div class="px-2 py-0.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 ${timerBadgeClass}">
            <span class="material-symbols-outlined text-[13px]">timer</span>
            <span class="kds-elapsed-timer" data-timestamp="${orderTime}">${timeFormatted}</span>
          </div>
        </div>
      </div>

      <!-- Customer & Type Subheader -->
      <div class="px-4 py-1.5 bg-surface-container-lowest border-b border-outline-variant/15 flex items-center justify-between text-xs text-on-surface-variant shrink-0">
        <div class="flex items-center gap-1.5 truncate">
          <span class="material-symbols-outlined text-[14px] text-primary">person</span>
          <span class="font-bold text-on-surface truncate">${order.customer?.name || 'Walk-in Customer'}</span>
        </div>
        <span class="font-mono text-[11px] opacity-70">${order.displayDate ? order.displayDate.split(',')[1] || order.displayDate : ''}</span>
      </div>

      <!-- Cooking Special Note (if any) -->
      ${order.orderNote ? `
        <div class="mx-3 my-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 font-semibold flex items-center gap-1.5 shrink-0">
          <span class="material-symbols-outlined text-amber-600 text-[16px]">priority_high</span>
          <span class="truncate">Note: ${order.orderNote}</span>
        </div>
      ` : ''}

      <!-- Items List (Scrollable, with Strike-through check) -->
      <div class="flex-1 overflow-y-auto px-4 py-2.5 flex flex-col gap-2">
        ${order.items.map((item, idx) => {
          const isChecked = order.checkedItems && order.checkedItems[idx];
          return `
            <div 
              onclick="pos.toggleKitchenItemChecked('${order.id}', ${idx})"
              class="flex flex-col p-2 rounded-xl transition-all cursor-pointer select-none border ${
                isChecked ? 'bg-surface-container-lowest/50 border-outline-variant/20 opacity-40 line-through' : 'bg-surface-container-low border-outline-variant/30 hover:border-primary/40'
              }"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2">
                  <div class="w-5 h-5 rounded-md ${isChecked ? 'bg-emerald-500 text-white' : 'bg-surface border border-outline-variant'} flex items-center justify-center shrink-0">
                    ${isChecked ? `<span class="material-symbols-outlined text-[13px]">check</span>` : ''}
                  </div>
                  <span class="font-extrabold text-[13.5px] text-on-surface leading-tight">
                    ${item.qty}x ${item.name}
                  </span>
                </div>
              </div>

              ${item.modifier ? `
                <div class="mt-1 pl-7 text-[11px] flex items-center gap-1">
                  ${['Quarter', 'Half', 'Full'].includes(item.modifier) ? `
                    <span class="px-2 py-0.5 rounded-md bg-amber-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px]">pie_chart</span>
                      <span>${item.modifier} Size</span>
                    </span>
                  ` : `
                    <span class="text-primary font-bold flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px]">tune</span>
                      <span>${item.modifier}</span>
                    </span>
                  `}
                </div>
              ` : ''}

              <!-- Combo sub-items breakdown -->
              ${item.isCombo && item.comboItems && item.comboItems.length > 0 ? `
                <div class="mt-1.5 pl-7 flex flex-col gap-0.5 border-l-2 border-amber-500/40 text-[11px] text-on-surface-variant font-medium">
                  ${item.comboItems.map(ci => `
                    <div class="flex items-center gap-1">
                      <span>• ${(ci.qty || 1) * item.qty}x ${ci.name}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Card Action Footer -->
      <div class="p-3 bg-surface-container-low border-t border-outline-variant/20 shrink-0 flex items-center gap-2">
        ${isPending ? `
          <button 
            onclick="pos.updateKitchenStatus('${order.id}', 'Preparing')"
            class="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">skillet</span>
            Start Cooking
          </button>
        ` : (isPreparing ? `
          <button 
            onclick="pos.updateKitchenStatus('${order.id}', 'Ready')"
            class="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">check_circle</span>
            Mark Ready
          </button>
        ` : (isReady ? `
          <button 
            onclick="pos.updateKitchenStatus('${order.id}', 'Served')"
            class="flex-1 h-10 rounded-xl bg-primary text-on-primary font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">done_all</span>
            Serve / Complete
          </button>
        ` : `
          <button 
            onclick="pos.updateKitchenStatus('${order.id}', 'Preparing')"
            class="flex-1 h-10 rounded-xl border border-outline-variant text-on-surface font-label-bold text-xs flex items-center justify-center gap-1.5 hover:bg-surface-variant transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">replay</span>
            Recall Order
          </button>
        `))}

        <button 
          onclick="printKitchenKOT('${order.id}')"
          class="w-10 h-10 rounded-xl border border-outline-variant/30 bg-surface hover:bg-surface-variant text-on-surface flex items-center justify-center transition-all shadow-xs active:scale-90"
          title="Print KOT Slip"
        >
          <span class="material-symbols-outlined text-[18px]">print</span>
        </button>
      </div>
    </div>
  `;
}

function setKitchenFilter(filter) {
  pos.kitchenFilter = filter;
  updateKitchenScreenDOM();
}

function updateKitchenScreenDOM() {
  const container = document.getElementById("kitchen-cards-container");
  if (!container) {
    if (pos.currentRoute === "kitchen") renderApp();
    return;
  }
  const filter = pos.kitchenFilter || "all";
  const orders = pos.getActiveKitchenOrders(filter);

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="h-full min-h-[380px] flex flex-col items-center justify-center text-center text-on-surface-variant gap-4 bg-surface-container-low/40 rounded-3xl border-2 border-dashed border-outline-variant/30 p-8 my-auto">
        <div class="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-sm">
          <span class="material-symbols-outlined text-[44px]">check_circle</span>
        </div>
        <div class="flex flex-col gap-1 max-w-md">
          <h3 class="font-headline-lg text-lg font-bold text-on-surface">All Orders Prepared!</h3>
          <p class="font-body-md text-xs text-on-surface-variant">
            No pending orders in this kitchen queue. Whenever an order is confirmed at the POS counter, it will pop up here with an automatic sound chime.
          </p>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5 auto-rows-max">
        ${orders.map(order => renderKitchenOrderCard(order)).join('')}
      </div>
    `;
  }
}

function toggleKDSFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

function playOrderSuccessChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const notes = [
      { freq: 523.25, time: 0.00, duration: 0.16 }, // C5
      { freq: 659.25, time: 0.12, duration: 0.16 }, // E5
      { freq: 783.99, time: 0.24, duration: 0.20 }, // G5
      { freq: 1046.50, time: 0.38, duration: 0.50 } // C6
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle'; // warm harmonic bell
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + note.time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + note.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + note.time);
      osc.stop(ctx.currentTime + note.time + note.duration);
    });
  } catch (err) {
    console.warn("Audio chime not allowed:", err);
  }
}

function playOrderReadyChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const notes = [
      { freq: 783.99, time: 0.00, duration: 0.25 }, // G5
      { freq: 1174.66, time: 0.18, duration: 0.60 } // D6
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);
      gain.gain.setValueAtTime(0.35, ctx.currentTime + note.time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + note.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + note.time);
      osc.stop(ctx.currentTime + note.time + note.duration);
    });
  } catch (err) {
    console.warn("Audio chime not allowed:", err);
  }
}

function playKitchenAudioChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Tone 1 (High D5 = 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Tone 2 (Higher A5 = 880 Hz, 0.18s later)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.18);
    gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.65);
  } catch (err) {
    console.warn("Audio chime not allowed:", err);
  }
}

function updateKitchenBadgeDOM() {
  const badge = document.getElementById("kds-pending-badge");
  const mobileBadge = document.getElementById("kds-pending-badge-mobile");
  const count = pos.getPendingKitchenCount();
  [badge, mobileBadge].forEach(b => {
    if (!b) return;
    if (count > 0) {
      b.textContent = count;
      b.classList.remove("hidden");
    } else {
      b.classList.add("hidden");
    }
  });
}

function printKitchenKOT(orderId) {
  const order = pos.orders.find(o => o.id === orderId) || pos.activeTransaction;
  if (!order) {
    showToast("Order not found to print KOT", "error", "error");
    return;
  }

  const printContainer = document.getElementById("thermal-receipt-container");
  if (!printContainer) return;

  const widthStyle = pos.settings.paperWidth === "58mm" ? "58mm" : "80mm";
  printContainer.style.width = widthStyle;
  printContainer.style.maxWidth = widthStyle;

  printContainer.innerHTML = `
    <div style="text-align: center; margin-bottom: 6px; font-family: monospace;">
      <h2 style="font-size: 16px; font-weight: bold; margin: 0; text-transform: uppercase;">*** KITCHEN ORDER TICKET (KOT) ***</h2>
      <p style="font-size: 11px; margin: 2px 0;">${pos.settings.storeName.toUpperCase()}</p>
      <p style="font-size: 14px; font-weight: bold; margin: 4px 0; border: 2px solid black; padding: 4px;">
        ${order.kitchenToken || 'TOKEN'} · ${order.orderType || 'DINE IN'}
      </p>
      <p style="font-size: 10px; margin: 2px 0;">Order #: ${order.receiptNumber} | Time: ${order.displayDate || new Date().toLocaleTimeString()}</p>
      <p style="font-size: 10px; margin: 2px 0;">Customer: ${order.customer?.name || 'Walk-in'}</p>
      <p style="margin: 4px 0; border-bottom: 2px dashed black;"></p>
    </div>

    <div style="font-size: 13px; font-family: monospace; line-height: 1.4;">
      ${order.items.map(item => `
        <div style="margin-bottom: 6px; border-bottom: 1px dotted #888; padding-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
            <span>[ ] ${item.qty}x ${item.name}</span>
          </div>
          ${item.modifier ? `<div style="font-size: 11px; font-weight: bold; padding-left: 14px;">>> ${item.modifier}</div>` : ''}
          ${item.isCombo && item.comboItems && item.comboItems.length > 0 ? `
            <div style="font-size: 11px; padding-left: 14px; margin-top: 2px;">
              ${item.comboItems.map(ci => `<div>- ${(ci.qty || 1) * item.qty}x ${ci.name}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>

    ${order.orderNote ? `
      <div style="font-size: 11px; font-family: monospace; font-weight: bold; border: 1px solid black; padding: 4px; margin: 6px 0;">
        SPECIAL INSTRUCTION:<br/>
        ${order.orderNote}
      </div>
    ` : ''}

    <div style="text-align: center; font-size: 10px; margin-top: 10px; font-family: monospace;">
      <p style="margin: 0;">* * * END OF KOT * * *</p>
    </div>
  `;

  window.print();
  showToast("KOT Ticket printed for kitchen", "success", "print");
}

// ==========================================
// SCREEN 7: SETTINGS & CASH DRAWER VIEW
// ==========================================

function renderSettingsView() {
  return `
  <div class="flex flex-col w-full h-[calc(100vh-64px)] p-3 sm:p-margin-edge pb-24 md:pb-8 overflow-y-auto animate-screen-enter select-none">
    
    <!-- Top Header Bar -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="font-headline-lg text-lg sm:text-headline-lg text-on-surface font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px] sm:text-[28px]">settings</span>
          POS Settings & Store Configuration
        </h1>
        <span class="font-label-bold text-xs bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-bold hidden sm:inline-block">
          Enterprise POS Suite
        </span>
      </div>
      <button 
        id="save-settings-btn"
        class="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-on-primary font-headline-md text-sm flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95"
      >
        <span class="material-symbols-outlined text-[18px]">save</span>
        Save All Settings
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 pb-8">
      
      <!-- Card 1: 🏪 Store Profile & Business Details -->
      <div class="bg-surface-container-low p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col gap-4 border border-outline-variant/30">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <h2 class="font-headline-md text-base text-on-surface flex items-center gap-2 font-bold">
            <span class="material-symbols-outlined text-primary">storefront</span>
            Store Profile & Legal Entity
          </h2>
          <div class="p-1.5 bg-surface rounded-xl border border-outline-variant/30 shadow-xs">
            <img src="./assets/mgn_logo.png" alt="MGN Logo" class="h-6 w-auto object-contain" onerror="this.src='./mgn_logo.png'" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Cafe / Store Name *</label>
            <input id="set-store-name" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.storeName}" placeholder="e.g. MGN Cafe" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Branch / Location *</label>
            <input id="set-store-branch" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.storeBranch}" placeholder="e.g. Main Branch · Station A" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Terminal ID</label>
            <input id="set-terminal" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.terminal || 'Terminal #01'}" placeholder="Terminal #01" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Active Cashier / Operator</label>
            <input id="set-cashier" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.cashier}" placeholder="Cashier" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Official Phone (Bills/SMS)</label>
            <input id="set-receipt-phone" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.receiptPhone}" placeholder="+91 98765 43210" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Business Email</label>
            <input id="set-business-email" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.businessEmail || ''}" placeholder="billing@mgncafe.in" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">GSTIN / Tax ID</label>
            <input id="set-gstin" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary uppercase font-bold" value="${pos.settings.gstin || ''}" placeholder="07AAAAA0000A1Z5" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">UPI ID (VPA for QR)</label>
            <input id="set-upi-id" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary lowercase font-medium" value="${pos.settings.upiId || ''}" placeholder="mgncafe@upi" />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Cafe Physical Address</label>
          <input id="set-receipt-address" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.receiptAddress}" placeholder="Full address, City, Pincode" />
        </div>
      </div>

      <!-- Card 2: 💳 Taxes, Currency & Calculation Rules -->
      <div class="bg-surface-container-low p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col gap-4 border border-outline-variant/30">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <h2 class="font-headline-md text-base text-on-surface flex items-center gap-2 font-bold">
            <span class="material-symbols-outlined text-secondary">calculate</span>
            Taxes, Currency & Invoice Rules
          </h2>
          <span class="font-label-bold text-xs text-secondary bg-secondary-container px-2.5 py-0.5 rounded-full font-bold">GST Ready</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="font-label-bold text-xs text-on-surface-variant font-bold">GST Rate (%)</label>
              <span id="tax-status-badge" class="font-bold text-[11px] px-2 py-0.5 rounded-full ${(pos.settings.taxRate === 0 || !pos.settings.taxRate) ? 'bg-emerald-500/10 text-emerald-700' : 'bg-primary/10 text-primary'}">
                ${(pos.settings.taxRate === 0 || !pos.settings.taxRate) ? '0% (Exempt / College Stall)' : `${pos.settings.taxRate}% GST`}
              </span>
            </div>
            <input 
              id="set-tax-rate" 
              type="number" 
              step="0.1" 
              min="0" 
              max="100" 
              class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary font-bold" 
              value="${pos.settings.taxRate !== undefined ? pos.settings.taxRate : 0}" 
              placeholder="0"
              oninput="const b = document.getElementById('tax-status-badge'); if (b) { const v = parseFloat(this.value); b.textContent = (v === 0 || isNaN(v)) ? '0% (Exempt / College Stall)' : v + '% GST'; b.className = 'font-bold text-[11px] px-2 py-0.5 rounded-full ' + ((v === 0 || isNaN(v)) ? 'bg-emerald-500/10 text-emerald-700' : 'bg-primary/10 text-primary'); }"
            />
            <div class="flex items-center gap-1.5 pt-0.5 flex-wrap">
              <span class="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Presets:</span>
              <button type="button" onclick="const el=document.getElementById('set-tax-rate'); if(el){el.value='0'; el.dispatchEvent(new Event('input'));}" class="h-6 px-2 rounded-lg bg-surface-container hover:bg-emerald-500/15 text-on-surface hover:text-emerald-700 text-[11px] font-bold border border-outline-variant/30 active:scale-95 transition-all">0% (College Stall)</button>
              <button type="button" onclick="const el=document.getElementById('set-tax-rate'); if(el){el.value='5'; el.dispatchEvent(new Event('input'));}" class="h-6 px-2 rounded-lg bg-surface-container hover:bg-primary/10 text-on-surface text-[11px] font-bold border border-outline-variant/30 active:scale-95 transition-all">5% (F&B)</button>
              <button type="button" onclick="const el=document.getElementById('set-tax-rate'); if(el){el.value='12'; el.dispatchEvent(new Event('input'));}" class="h-6 px-2 rounded-lg bg-surface-container hover:bg-primary/10 text-on-surface text-[11px] font-bold border border-outline-variant/30 active:scale-95 transition-all">12%</button>
              <button type="button" onclick="const el=document.getElementById('set-tax-rate'); if(el){el.value='18'; el.dispatchEvent(new Event('input'));}" class="h-6 px-2 rounded-lg bg-surface-container hover:bg-primary/10 text-on-surface text-[11px] font-bold border border-outline-variant/30 active:scale-95 transition-all">18%</button>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Currency Symbol</label>
            <input id="set-currency" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary font-bold" value="${pos.settings.currency}" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Tax Application Mode</label>
            <select id="set-tax-mode" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary">
              <option value="exclusive" ${pos.settings.taxMode === 'exclusive' ? 'selected' : ''}>Exclusive (Added on top of Bill)</option>
              <option value="inclusive" ${pos.settings.taxMode === 'inclusive' ? 'selected' : ''}>Inclusive (Included in Product Price)</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Invoice / Bill Prefix</label>
            <input id="set-invoice-prefix" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary uppercase font-bold" value="${pos.settings.invoicePrefix || 'MGN-'}" placeholder="MGN-" />
          </div>
        </div>

        <div class="flex items-center justify-between p-3 bg-surface rounded-xl border border-outline-variant/30 mt-1">
          <div class="flex flex-col">
            <span class="font-label-bold text-xs text-on-surface font-bold">Auto Round-off Bill Total</span>
            <span class="text-[11px] text-on-surface-variant">Round final bill amount to nearest integer</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input id="set-auto-roundoff" type="checkbox" class="sr-only peer" ${pos.settings.autoRoundOff ? 'checked' : ''} />
            <div class="w-10 h-6 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      <!-- Card 3: 💰 Cash Drawer Audit & Shift Float -->
      <div class="bg-surface-container-low p-5 rounded-2xl shadow-sm flex flex-col gap-4 border border-outline-variant/30">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <h2 class="font-headline-md text-base text-on-surface flex items-center gap-2 font-bold">
            <span class="material-symbols-outlined text-secondary">point_of_sale</span>
            Cash Drawer Float & Petty Cash
          </h2>
          <span class="font-label-bold text-xs text-on-surface-variant">Drawer ID: #DR-01</span>
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Default Opening Float (${pos.settings.currency})</label>
          <input id="set-starting-float" type="number" step="100" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary font-bold" value="${pos.settings.drawerFloat || 0}" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div class="p-3 bg-surface rounded-xl shadow-xs border border-outline-variant/20 flex flex-col">
            <span class="font-label-sm text-[11px] text-on-surface-variant">Starting Float</span>
            <p class="font-headline-md text-on-surface font-bold text-sm mt-0.5">${pos.settings.currency}${(pos.drawer.startingFloat || 0).toFixed(2)}</p>
          </div>
          <div class="p-3 bg-surface rounded-xl shadow-xs border border-outline-variant/20 flex flex-col">
            <span class="font-label-sm text-[11px] text-on-surface-variant">Cash Sales Today</span>
            <p class="font-headline-md text-primary font-bold text-sm mt-0.5">${pos.settings.currency}${(pos.drawer.cashSales || 0).toFixed(2)}</p>
          </div>
          <div class="p-3 bg-surface rounded-xl shadow-xs border border-outline-variant/20 flex flex-col">
            <span class="font-label-sm text-[11px] text-on-surface-variant">Current Cash in Drawer</span>
            <p class="font-headline-md text-secondary font-bold text-sm mt-0.5">${pos.settings.currency}${(pos.drawer.currentBalance || 0).toFixed(2)}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-1">
          <button 
            onclick="openCashDrawerActionModal('add')"
            class="h-10 px-3 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary font-label-bold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[16px]">add_circle</span>
            + Add Cash / Float In
          </button>
          <button 
            onclick="openCashDrawerActionModal('payout')"
            class="h-10 px-3 rounded-xl bg-error/10 hover:bg-error/20 text-error font-label-bold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[16px]">remove_circle</span>
            - Cash Drop / Payout
          </button>
        </div>
      </div>

      <!-- Card 4: 🧾 Thermal Print Receipt & Layout -->
      <div class="bg-surface-container-low p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col gap-4 border border-outline-variant/30">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <h2 class="font-headline-md text-base text-on-surface flex items-center gap-2 font-bold">
            <span class="material-symbols-outlined text-primary">receipt_long</span>
            Thermal Print Receipt Format
          </h2>
          <select id="set-paper-width" class="h-8 px-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-label-bold text-xs outline-none">
            <option value="80mm" ${pos.settings.paperWidth === '80mm' ? 'selected' : ''}>80mm Standard</option>
            <option value="58mm" ${pos.settings.paperWidth === '58mm' ? 'selected' : ''}>58mm Compact</option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Receipt Header Greeting / Tagline</label>
          <input id="set-receipt-header" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.receiptHeader}" placeholder="e.g. Welcome to MGN Cafe · Artisan Coffee" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Receipt Footer Thank You Message</label>
          <input id="set-receipt-footer" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${pos.settings.receiptFooter}" placeholder="e.g. Thank you for visiting MGN Cafe! Have a great day." />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <label class="flex items-center gap-2 p-2 bg-surface rounded-xl border border-outline-variant/30 text-xs font-semibold cursor-pointer">
            <input id="set-show-logo" type="checkbox" class="rounded text-primary focus:ring-0" ${pos.settings.showLogoOnReceipt !== false ? 'checked' : ''} />
            <span>Print Logo</span>
          </label>
          <label class="flex items-center gap-2 p-2 bg-surface rounded-xl border border-outline-variant/30 text-xs font-semibold cursor-pointer">
            <input id="set-show-gstin" type="checkbox" class="rounded text-primary focus:ring-0" ${pos.settings.showGstinOnReceipt !== false ? 'checked' : ''} />
            <span>Print GSTIN</span>
          </label>
          <label class="flex items-center gap-2 p-2 bg-surface rounded-xl border border-outline-variant/30 text-xs font-semibold cursor-pointer">
            <input id="set-show-customer" type="checkbox" class="rounded text-primary focus:ring-0" ${pos.settings.showCustomerOnReceipt !== false ? 'checked' : ''} />
            <span>Print Customer</span>
          </label>
        </div>

        <div class="pt-1">
          <button 
            id="test-print-receipt-btn"
            type="button"
            class="w-full h-10 rounded-xl bg-surface hover:bg-surface-variant text-primary border border-primary/30 font-label-bold text-xs flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[16px]">print</span>
            Test Print Sample Thermal Receipt
          </button>
        </div>
      </div>

      <!-- Card 5: 🗄️ Database, Full Backup & Order History Deletion (Full Width) -->
      <div class="col-span-1 lg:col-span-2 bg-surface-container-low p-5 rounded-2xl shadow-sm flex flex-col gap-4 border border-outline-variant/30">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-error text-[22px]">database</span>
            <h2 class="font-headline-md text-base text-on-surface font-bold">Database, Full Backup & Order History Deletion</h2>
          </div>
          <span class="font-label-bold text-xs text-on-surface-variant">${pos.orders.length} Orders · ${pos.products.length} Products · ${pos.investments.length} Expenses</span>
        </div>

        <!-- Dedicated Order History Deletion Box -->
        <div class="p-4 bg-surface rounded-2xl border border-error/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-2xl bg-error/15 text-error flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[24px]">delete_sweep</span>
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="font-headline-md text-sm font-extrabold text-on-surface">Order History & Sales Records Deletion</span>
                <span class="px-2 py-0.5 rounded-full bg-error/10 text-error font-mono font-bold text-[11px]">${pos.orders.length} Saved</span>
              </div>
              <span class="text-xs text-on-surface-variant">Delete test bills, clear today's transactions, or wipe complete historical orders with 1-click.</span>
            </div>
          </div>
          <button 
            onclick="openDeleteOrderHistoryModal()"
            class="h-10 px-4 rounded-xl bg-error text-on-error hover:bg-error/90 font-label-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all shrink-0"
          >
            <span class="material-symbols-outlined text-[16px]">delete_sweep</span>
            Delete Order History
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <button 
            id="clear-investments-btn" 
            class="h-11 px-3 rounded-xl bg-surface hover:bg-surface-variant text-on-surface border border-outline-variant/40 font-label-bold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[16px]">receipt</span>
            Clear Expense Logs (${pos.investments.length})
          </button>

          <button 
            id="backup-data-btn" 
            class="h-11 px-3 rounded-xl bg-surface hover:bg-surface-variant text-primary border border-primary/30 font-label-bold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[16px]">file_download</span>
            Export Full JSON Backup
          </button>

          <button 
            id="reset-data-btn" 
            class="h-11 px-3 rounded-xl bg-error/15 text-error hover:bg-error hover:text-on-error font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">restart_alt</span>
            Factory Reset Everything
          </button>
        </div>

        <!-- Hidden file input for restore -->
        <input id="restore-backup-file-input" type="file" accept=".json" class="hidden" />
        <div class="flex items-center justify-between p-3 bg-surface rounded-xl border border-outline-variant/20 text-xs">
          <span class="text-on-surface-variant">Want to restore POS database from a previous JSON backup file?</span>
          <button id="trigger-restore-btn" class="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-bold flex items-center gap-1.5 transition-colors active:scale-95">
            <span class="material-symbols-outlined text-[15px]">upload_file</span>
            Restore Backup File
          </button>
        </div>
      </div>

      <!-- Card 6: 📱 Tablet App & Offline PWA Installation -->
      <div class="col-span-1 lg:col-span-2 bg-surface-container-low p-5 rounded-2xl shadow-sm flex flex-col gap-4 border border-outline-variant/30">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[22px]">tablet_android</span>
            <h2 class="font-headline-md text-base text-on-surface font-bold">Tablet App Installation & Offline Standalone Mode</h2>
          </div>
          <span class="font-label-bold text-xs bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full font-bold">
            100% Offline Ready
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-3.5 bg-surface rounded-xl border border-outline-variant/30 flex flex-col gap-1.5">
            <div class="flex items-center gap-2 text-primary font-bold text-xs">
              <span class="material-symbols-outlined text-[18px]">android</span>
              Android Tablet / Phone
            </div>
            <p class="text-[11.5px] text-on-surface-variant leading-relaxed">
              Chrome me open karein -> Top right <strong>⋮ (3 dots)</strong> dabayein -> <strong>"Install app"</strong> ya <strong>"Add to Home screen"</strong> chunein.
            </p>
          </div>

          <div class="p-3.5 bg-surface rounded-xl border border-outline-variant/30 flex flex-col gap-1.5">
            <div class="flex items-center gap-2 text-primary font-bold text-xs">
              <span class="material-symbols-outlined text-[18px]">phone_iphone</span>
              Apple iPad / iPhone
            </div>
            <p class="text-[11.5px] text-on-surface-variant leading-relaxed">
              Safari browser me open karein -> Bottom me <strong>Share button</strong> dabayein -> <strong>"Add to Home Screen"</strong> par tap karein.
            </p>
          </div>

          <div class="p-3.5 bg-surface rounded-xl border border-outline-variant/30 flex flex-col gap-1.5">
            <div class="flex items-center gap-2 text-primary font-bold text-xs">
              <span class="material-symbols-outlined text-[18px]">desktop_windows</span>
              Windows PC / Mac
            </div>
            <p class="text-[11.5px] text-on-surface-variant leading-relaxed">
              Chrome/Edge URL bar me right side <strong>Install App icon (⊕)</strong> dabayein -> Desktop Standalone Window ban jayega.
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between p-3 bg-surface rounded-xl border border-outline-variant/20">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-[20px]">verified</span>
            <span class="text-xs text-on-surface font-semibold">Service Worker active. POS cache enables 100% offline billing on all devices.</span>
          </div>
        </div>
      </div>

    </div>
  </div>
  `;
}

function openCashDrawerActionModal(type = "add") {
  const isAdd = type === "add";
  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-sm w-full mx-2 sm:mx-auto p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center pb-2 border-b border-outline-variant/20">
        <h3 class="font-headline-lg text-base font-bold text-on-surface flex items-center gap-2">
          <span class="material-symbols-outlined ${isAdd ? 'text-secondary' : 'text-error'}">${isAdd ? 'add_circle' : 'remove_circle'}</span>
          ${isAdd ? 'Add Cash to Drawer (Float In)' : 'Cash Drop / Payout (Float Out)'}
        </h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Amount (${pos.settings.currency}) *</label>
          <input id="drawer-action-amount" type="number" step="10" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary font-bold" placeholder="500" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Reason / Description *</label>
          <input id="drawer-action-reason" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="${isAdd ? 'e.g. Added coins & change float' : 'e.g. Vendor payout / Bank drop'}" />
        </div>
      </div>

      <div class="flex gap-3 pt-2 border-t border-outline-variant/20">
        <button onclick="closeModal()" class="flex-1 h-10 rounded-xl border border-outline-variant font-label-bold text-on-surface text-xs">Cancel</button>
        <button id="save-drawer-action-btn" class="flex-1 h-10 rounded-xl ${isAdd ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'} font-label-bold text-xs shadow-md active:scale-95">Confirm</button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  document.getElementById("save-drawer-action-btn")?.addEventListener("click", () => {
    const amt = parseFloat(document.getElementById("drawer-action-amount").value) || 0;
    const reason = document.getElementById("drawer-action-reason").value.trim() || (isAdd ? "Cash In" : "Cash Out");
    if (amt <= 0) {
      showToast("Please enter a valid amount", "error", "error");
      return;
    }
    if (isAdd) {
      pos.drawer.cashIn = (pos.drawer.cashIn || 0) + amt;
      pos.drawer.currentBalance += amt;
      pos.drawer.logs.unshift({ time: new Date().toLocaleTimeString(), type: "Cash In", amount: amt, note: reason });
      pos.saveDrawer();
      showToast(`Added ${pos.settings.currency}${amt.toFixed(2)} to Drawer`, "success", "payments");
    } else {
      if (amt > pos.drawer.currentBalance) {
        showToast("Cannot withdraw more than current drawer balance", "error", "error");
        return;
      }
      pos.drawer.cashOut = (pos.drawer.cashOut || 0) + amt;
      pos.drawer.currentBalance -= amt;
      pos.drawer.logs.unshift({ time: new Date().toLocaleTimeString(), type: "Cash Drop/Out", amount: amt, note: reason });
      pos.saveDrawer();
      showToast(`Withdrew ${pos.settings.currency}${amt.toFixed(2)} from Drawer`, "info", "payments");
    }
    closeModal();
    if (pos.currentRoute === "settings") {
      renderApp();
    }
  });
}

// ==========================================
// 8. PRODUCT CUSTOMIZER POPUP & PHOTO MODALS
// ==========================================

function openItemCustomizePopup(productId) {
  const product = pos.products.find(p => p.id === productId);
  if (!product) return;

  let modifiers = product.availableModifiers && product.availableModifiers.length > 0 
    ? [...product.availableModifiers] 
    : [];

  if (modifiers.length === 0) {
    const lowerName = (product.name + ' ' + (product.category || '')).toLowerCase();
    if (lowerName.includes("pizza")) {
      modifiers = ["Regular (8 inch)", "Medium (10 inch)", "Large (12 inch)", "Extra Cheese", "Thin Crust", "Cheese Burst"];
    } else if (lowerName.includes("burger")) {
      modifiers = ["Regular", "Double Patty", "Extra Cheese", "No Onion", "Spicy"];
    } else if (lowerName.includes("coffee") || lowerName.includes("tea") || lowerName.includes("beverage")) {
      modifiers = ["Hot", "Iced / Cold", "Less Sugar", "Extra Shot", "Standard"];
    } else {
      modifiers = [product.defaultModifier || "Standard", "Extra Prep", "Custom Note"];
    }
  }

  let selectedMod = product.defaultModifier || modifiers[0];
  let customQty = 1;

  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full mx-2 sm:mx-auto p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-start pb-2 border-b border-outline-variant/20">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center overflow-hidden shrink-0" style="background-color: ${product.color || '#eff4ff'};">
            ${product.img ? `<img src="${product.img}" class="w-full h-full object-cover" />` : `<span class="material-symbols-outlined text-primary text-[28px]">${product.fallbackIcon}</span>`}
          </div>
          <div>
            <h3 class="font-headline-md font-bold text-on-surface text-base">${product.name}</h3>
            <span class="text-primary font-bold text-sm">${pos.settings.currency}${product.price.toFixed(2)}</span>
          </div>
        </div>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-label-bold text-xs text-on-surface-variant font-bold">Select Size / Preference</label>
        <div class="flex flex-wrap gap-2">
          ${modifiers.map(mod => `
            <button 
              type="button"
              class="quick-mod-chip px-3 py-1.5 rounded-xl text-xs font-label-bold border transition-all ${selectedMod === mod ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface text-on-surface border-outline-variant/40 hover:bg-surface-container'}"
              data-mod="${mod}"
            >
              ${mod}
            </button>
          `).join('')}
        </div>
        
        <input 
          id="cust-custom-note" 
          type="text" 
          placeholder="Or custom preference (e.g. No Capsicum, Well Done)..." 
          class="h-9 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary mt-1" 
        />
      </div>

      <div class="flex justify-between items-center p-3 bg-surface-container rounded-xl">
        <span class="font-label-bold text-xs text-on-surface font-bold">Quantity</span>
        <div class="flex items-center gap-3">
          <button id="cust-qty-dec" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center font-bold text-base shadow-sm active:scale-90">-</button>
          <span id="cust-qty-val" class="font-bold text-base w-6 text-center">1</span>
          <button id="cust-qty-inc" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center font-bold text-base shadow-sm active:scale-90">+</button>
        </div>
      </div>

      <div class="flex gap-3 pt-2 border-t border-outline-variant/20">
        <button onclick="closeModal()" class="flex-1 h-12 rounded-xl border border-outline-variant font-label-bold text-on-surface">Cancel</button>
        <button id="cust-add-to-cart-btn" class="flex-1 h-12 rounded-xl bg-primary text-on-primary font-label-bold shadow-md hover:bg-primary/90 active:scale-95 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-[18px]">add_shopping_cart</span>
          <span id="cust-add-btn-label">Add - ${pos.settings.currency}${product.price.toFixed(2)}</span>
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  document.querySelectorAll(".quick-mod-chip").forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll(".quick-mod-chip").forEach(c => {
        c.classList.remove('bg-primary', 'text-on-primary', 'border-primary', 'shadow-sm');
        c.classList.add('bg-surface', 'text-on-surface', 'border-outline-variant/40');
      });
      chip.classList.remove('bg-surface', 'text-on-surface', 'border-outline-variant/40');
      chip.classList.add('bg-primary', 'text-on-primary', 'border-primary', 'shadow-sm');
      selectedMod = chip.dataset.mod;
      const customNoteInput = document.getElementById("cust-custom-note");
      if (customNoteInput) customNoteInput.value = "";
    };
  });

  const qtyEl = document.getElementById("cust-qty-val");
  const btnLabel = document.getElementById("cust-add-btn-label");
  const customNoteInput = document.getElementById("cust-custom-note");

  customNoteInput?.addEventListener("input", (e) => {
    if (e.target.value.trim()) {
      document.querySelectorAll(".quick-mod-chip").forEach(c => {
        c.classList.remove('bg-primary', 'text-on-primary', 'border-primary', 'shadow-sm');
        c.classList.add('bg-surface', 'text-on-surface', 'border-outline-variant/40');
      });
      selectedMod = e.target.value.trim();
    }
  });

  document.getElementById("cust-qty-inc")?.addEventListener("click", () => {
    customQty += 1;
    qtyEl.textContent = customQty;
    btnLabel.textContent = `Add (${customQty}) - ${pos.settings.currency}${(product.price * customQty).toFixed(2)}`;
  });

  document.getElementById("cust-qty-dec")?.addEventListener("click", () => {
    if (customQty > 1) {
      customQty -= 1;
      qtyEl.textContent = customQty;
      btnLabel.textContent = `Add (${customQty}) - ${pos.settings.currency}${(product.price * customQty).toFixed(2)}`;
    }
  });

  document.getElementById("cust-add-to-cart-btn")?.addEventListener("click", () => {
    const finalMod = (customNoteInput && customNoteInput.value.trim()) ? customNoteInput.value.trim() : selectedMod;
    for (let i = 0; i < customQty; i++) {
      pos.addToCart(product, finalMod);
    }
    closeModal();
    showToast(`Added ${customQty}x ${product.name} (${finalMod})`, "success", "check");
  });
}

const CAFE_ICONS = [
  { icon: "local_cafe", label: "Coffee" },
  { icon: "lunch_dining", label: "Burger" },
  { icon: "cake", label: "Cake" },
  { icon: "bakery_dining", label: "Bakery" },
  { icon: "local_pizza", label: "Pizza" },
  { icon: "fastfood", label: "Fries" },
  { icon: "salad", label: "Salad" },
  { icon: "cookie", label: "Cookie" },
  { icon: "icecream", label: "Ice Cream" },
  { icon: "water_full", label: "Drinks" },
  { icon: "emoji_food_beverage", label: "Tea" },
  { icon: "restaurant", label: "Meal" }
];

const COLOR_PRESETS = [
  "#eff4ff", "#ffddb8", "#6cf8bb", "#ffdad6", "#d3e4fe", "#f3e8ff", "#fff4cc"
];

function openProductModal(productId = null) {
  const isEditing = Boolean(productId);
  const product = isEditing 
    ? pos.products.find(p => p.id === productId) 
    : {
        id: "",
        name: "",
        category: pos.categories[1] || "Beverages",
        price: 150.00,
        costPrice: 50.00,
        stock: 50,
        sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
        defaultModifier: "",
        img: "",
        fallbackIcon: "local_cafe",
        color: "#eff4ff",
        isCombo: false,
        comboItems: []
      };

  let currentImageSrc = product.img || "";
  let selectedIcon = product.fallbackIcon || "local_cafe";
  let selectedColor = product.color || "#eff4ff";
  let isComboState = Boolean(product.isCombo);
  let comboItemsList = Array.isArray(product.comboItems) ? JSON.parse(JSON.stringify(product.comboItems)) : [];

  const existingPortions = product.portions || (isPortionItem(product) ? getPortionPrices(product) : null);
  const hasPortionsInitial = Boolean(product.portions?.hasPortions || (isPortionItem(product) && isEditing));
  const quarterVal = existingPortions ? (existingPortions.quarterPrice || existingPortions.quarter || Math.round((product.price || 100) * 0.35)) : Math.round((product.price || 100) * 0.35);
  const halfVal = existingPortions ? (existingPortions.halfPrice || existingPortions.half || Math.round((product.price || 100) * 0.6)) : Math.round((product.price || 100) * 0.6);
  const fullVal = existingPortions ? (existingPortions.fullPrice || existingPortions.full || (product.price || 100)) : (product.price || 100);

  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-xl w-full mx-2 sm:mx-auto p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      
      <div class="flex justify-between items-center pb-2 border-b border-outline-variant/20">
        <h3 class="font-headline-lg text-lg font-bold text-on-surface flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">${isEditing ? 'edit_note' : 'add_a_photo'}</span>
          ${isEditing ? (isComboState ? 'Edit Combo Meal Deal' : 'Edit Product Item') : 'Add New Product / Combo'}
        </h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Combo Meal Deal Switcher -->
      <div class="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-amber-600 text-[22px]">local_fire_department</span>
          <div>
            <span class="font-label-bold text-xs font-bold text-on-surface">Combo Meal Deal / Value Pack</span>
            <p class="text-[11px] text-on-surface-variant">Bundle multiple menu items together at a special deal price</p>
          </div>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="pm-is-combo-toggle" class="sr-only peer" ${isComboState ? 'checked' : ''}>
          <div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
        </label>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Product / Combo Name *</label>
            <input id="pm-name" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${product.name}" placeholder="e.g. Burger + Fries + Coke Combo" />
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div class="flex flex-col gap-1">
              <label class="font-label-bold text-xs text-on-surface-variant font-bold">Price (${pos.settings.currency}) *</label>
              <input id="pm-price" type="number" step="5" class="h-10 px-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary font-bold" value="${product.price}" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-label-bold text-xs text-on-surface-variant font-bold">Cost (${pos.settings.currency})</label>
              <input id="pm-cost" type="number" step="5" class="h-10 px-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${product.costPrice || (product.price * 0.4).toFixed(0)}" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-label-bold text-xs text-on-surface-variant font-bold">Stock Qty</label>
              <input id="pm-stock" type="number" step="5" class="h-10 px-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${product.stock || 50}" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <label class="font-label-bold text-xs text-on-surface-variant font-bold">Category</label>
              <select id="pm-category" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary">
                ${pos.categories.filter(c => c !== "All Items").map(c => `
                  <option value="${c}" ${product.category === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-label-bold text-xs text-on-surface-variant font-bold">SKU Code</label>
              <input id="pm-sku" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${product.sku}" />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-label-bold text-xs text-on-surface-variant font-bold">Default Modifier Note</label>
            <input id="pm-modifier" class="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" value="${product.defaultModifier || ''}" placeholder="e.g. Less Sugar / Extra Cheese" />
          </div>

          <!-- Portion Sizes (Quarter / Half / Full) Section -->
          <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/30 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[18px]">pie_chart</span>
                <div>
                  <span class="font-label-bold text-xs font-bold text-on-surface">Portion Sizes (Quarter / Half / Full)</span>
                  <p class="text-[10px] text-on-surface-variant">Separate pricing for Pizza & Sweet Corn portions</p>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="pm-has-portions-toggle" class="sr-only peer" ${hasPortionsInitial ? 'checked' : ''}>
                <div class="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div id="pm-portions-section" class="grid grid-cols-3 gap-2 ${hasPortionsInitial ? '' : 'hidden'} pt-2 border-t border-outline-variant/20">
              <div class="flex flex-col gap-1">
                <label class="font-label-bold text-[10.5px] text-on-surface-variant font-bold">Quarter (₹)</label>
                <input id="pm-quarter-price" type="number" step="5" class="h-8 px-2 rounded-lg bg-surface border border-outline-variant text-on-surface text-xs font-bold outline-none focus:ring-1 focus:ring-primary" value="${quarterVal}" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-label-bold text-[10.5px] text-on-surface-variant font-bold">Half (₹)</label>
                <input id="pm-half-price" type="number" step="5" class="h-8 px-2 rounded-lg bg-surface border border-outline-variant text-on-surface text-xs font-bold outline-none focus:ring-1 focus:ring-primary" value="${halfVal}" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-label-bold text-[10.5px] text-on-surface-variant font-bold">Full (₹)</label>
                <input id="pm-full-price" type="number" step="5" class="h-8 px-2 rounded-lg bg-surface border border-outline-variant text-on-surface text-xs font-bold outline-none focus:ring-1 focus:ring-primary" value="${fullVal}" />
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container border border-outline-variant/30">
            <label class="font-label-bold text-xs text-on-surface font-bold flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-primary">add_photo_alternate</span>
              Product Photo (Upload or URL)
            </label>
            
            <div class="flex gap-2">
              <label class="flex-1 h-9 px-3 rounded-lg bg-primary text-on-primary font-label-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:bg-primary/90 transition-all active:scale-95">
                <span class="material-symbols-outlined text-[16px]">upload_file</span>
                <span>Upload from Device</span>
                <input id="pm-file-input" type="file" accept="image/*" class="hidden" />
              </label>
              
              <button 
                type="button" 
                id="pm-clear-img-btn" 
                class="h-9 px-2.5 rounded-lg border border-outline-variant bg-surface text-on-surface text-xs font-label-bold hover:bg-surface-variant transition-colors ${currentImageSrc ? '' : 'hidden'}"
                title="Remove Photo"
              >
                Clear
              </button>
            </div>

            <input id="pm-img-url" class="h-8 px-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-body-md text-xs outline-none focus:ring-2 focus:ring-primary mt-1" value="${product.img || ''}" placeholder="Or paste image web link..." />
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <label class="font-label-bold text-xs text-on-surface-variant font-bold">Fallback Icon & Color Accent</label>
          
          <div class="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-surface-container max-h-28 overflow-y-auto">
            ${CAFE_ICONS.map(item => `
              <button 
                type="button"
                class="pm-icon-btn p-2 rounded-lg flex flex-col items-center justify-center transition-colors ${selectedIcon === item.icon ? 'bg-primary text-on-primary' : 'bg-surface hover:bg-surface-variant text-on-surface'}"
                data-icon="${item.icon}"
              >
                <span class="material-symbols-outlined text-[20px]">${item.icon}</span>
                <span class="text-[9px] mt-0.5">${item.label}</span>
              </button>
            `).join('')}
          </div>

          <div class="flex items-center gap-1.5">
            ${COLOR_PRESETS.map(c => `
              <button 
                type="button" 
                class="pm-color-btn w-6 h-6 rounded-full border-2 ${selectedColor === c ? 'border-primary scale-110' : 'border-transparent'}" 
                style="background-color: ${c};"
                data-color="${c}"
              ></button>
            `).join('')}
          </div>

          <div class="flex flex-col gap-1 mt-auto">
            <span class="text-[10px] text-on-surface-variant font-bold uppercase">Live Card Preview:</span>
            <div id="pm-live-preview" class="w-full h-28 bg-surface rounded-xl p-2.5 shadow-sm border border-outline-variant/30 flex items-center gap-3" style="background-color: ${selectedColor};">
              <div id="preview-img-container" class="w-20 h-20 rounded-xl bg-surface-container flex items-center justify-center text-primary overflow-hidden shadow-sm shrink-0 relative">
                ${currentImageSrc ? `
                  <img id="preview-photo" src="${currentImageSrc}" class="w-full h-full object-cover" />
                ` : `
                  <span class="material-symbols-outlined text-[36px]" id="preview-icon">${selectedIcon}</span>
                `}
                <div id="preview-combo-tag" class="absolute top-1 right-1 px-1.5 py-0.2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[8px] rounded uppercase ${isComboState ? '' : 'hidden'}">
                  COMBO
                </div>
              </div>
              <div class="flex flex-col flex-1 min-w-0">
                <span class="font-bold text-xs text-on-surface truncate" id="preview-name">${product.name || 'Product Name'}</span>
                <span class="text-[10px] text-on-surface-variant" id="preview-cat">${product.category}</span>
                <span class="font-bold text-sm text-primary mt-1" id="preview-price">${pos.settings.currency}${parseFloat(product.price || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Combo Meal Builder Section -->
      <div id="pm-combo-builder-section" class="flex flex-col gap-2.5 p-3.5 bg-surface-container rounded-2xl border border-amber-500/30 ${isComboState ? '' : 'hidden'}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-amber-600 text-[18px]">fastfood</span>
            <span class="font-label-bold text-xs font-bold text-on-surface">Select Items Included in this Combo Deal</span>
          </div>
          <span id="combo-items-count-badge" class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 text-[10px] font-bold">
            ${comboItemsList.length} items bundled
          </span>
        </div>

        <div class="flex gap-2">
          <select id="combo-item-select" class="flex-1 h-9 px-3 rounded-xl bg-surface border border-outline-variant text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary">
            ${pos.products.filter(p => !p.isCombo && p.id !== product.id).length === 0 ? `
              <option value="">No standalone menu products available</option>
            ` : pos.products.filter(p => !p.isCombo && p.id !== product.id).map(p => `
              <option value="${p.id}">${p.name} (${pos.settings.currency}${p.price.toFixed(2)})</option>
            `).join('')}
          </select>
          <button 
            type="button" 
            id="combo-add-item-btn" 
            class="h-9 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-label-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[15px]">add</span>
            Add Item
          </button>
        </div>

        <div id="combo-items-list-container" class="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
          <!-- Rendered dynamically -->
        </div>

        <!-- Combo Savings Calculator Bar -->
        <div id="combo-savings-bar" class="flex items-center justify-between p-2.5 bg-surface rounded-xl border border-outline-variant/30 text-xs">
          <div class="flex flex-col">
            <span class="text-on-surface-variant text-[11px]">Regular Items Sum: <strong id="combo-regular-sum" class="text-on-surface">₹0.00</strong></span>
            <span class="text-on-surface-variant text-[11px]">Combo Deal Price: <strong id="combo-deal-price" class="text-primary font-bold">₹0.00</strong></span>
          </div>
          <div id="combo-savings-pill" class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 font-label-bold text-xs font-bold border border-emerald-500/30">
            Save ₹0 (0% OFF)
          </div>
        </div>
      </div>

      <div class="flex gap-3 pt-2 border-t border-outline-variant/20">
        <button onclick="closeModal()" class="flex-1 h-11 rounded-xl border border-outline-variant font-label-bold text-on-surface">Cancel</button>
        <button id="save-product-modal-btn" class="flex-1 h-11 rounded-xl bg-primary text-on-primary font-label-bold shadow-md hover:bg-primary/90 active:scale-95">
          ${isEditing ? 'Save Changes' : 'Create Product'}
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  const nameInput = document.getElementById("pm-name");
  const priceInput = document.getElementById("pm-price");
  const costInput = document.getElementById("pm-cost");
  const stockInput = document.getElementById("pm-stock");
  const catInput = document.getElementById("pm-category");
  const imgUrlInput = document.getElementById("pm-img-url");
  const fileInput = document.getElementById("pm-file-input");
  const clearImgBtn = document.getElementById("pm-clear-img-btn");
  const isComboToggle = document.getElementById("pm-is-combo-toggle");
  const comboSection = document.getElementById("pm-combo-builder-section");
  const comboListContainer = document.getElementById("combo-items-list-container");
  const comboTagEl = document.getElementById("preview-combo-tag");

  function renderComboItemsDOM() {
    if (!comboListContainer) return;

    if (comboItemsList.length === 0) {
      comboListContainer.innerHTML = `
        <div class="py-3 text-center text-on-surface-variant text-xs opacity-60">
          No items added yet. Select products above to bundle into this combo.
        </div>
      `;
    } else {
      comboListContainer.innerHTML = comboItemsList.map((ci, idx) => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-surface border border-outline-variant/20">
          <div class="flex items-center gap-2 truncate flex-1">
            <span class="w-5 h-5 rounded-full bg-amber-500/20 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">${ci.qty || 1}x</span>
            <span class="font-bold text-xs text-on-surface truncate">${ci.name}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-on-surface-variant font-medium">${pos.settings.currency}${((ci.defaultPrice || 0) * (ci.qty || 1)).toFixed(2)}</span>
            <div class="flex items-center gap-1 bg-surface-container rounded-md p-0.5">
              <button type="button" onclick="window.updateComboItemQty(${idx}, -1)" class="w-5 h-5 rounded bg-surface text-on-surface text-xs font-bold flex items-center justify-center hover:bg-surface-variant">-</button>
              <button type="button" onclick="window.updateComboItemQty(${idx}, 1)" class="w-5 h-5 rounded bg-surface text-on-surface text-xs font-bold flex items-center justify-center hover:bg-surface-variant">+</button>
            </div>
            <button type="button" onclick="window.removeComboItem(${idx})" class="text-error hover:text-error/80 p-0.5" title="Remove Item">
              <span class="material-symbols-outlined text-[15px]">close</span>
            </button>
          </div>
        </div>
      `).join('');
    }

    const regularSum = comboItemsList.reduce((sum, ci) => sum + ((ci.defaultPrice || 0) * (ci.qty || 1)), 0);
    const dealPrice = parseFloat(priceInput.value) || 0;
    const savings = Math.max(0, regularSum - dealPrice);
    const pct = regularSum > 0 ? Math.round((savings / regularSum) * 100) : 0;

    const countBadge = document.getElementById("combo-items-count-badge");
    if (countBadge) countBadge.textContent = `${comboItemsList.length} items bundled`;

    const regularSumEl = document.getElementById("combo-regular-sum");
    if (regularSumEl) regularSumEl.textContent = `${pos.settings.currency}${regularSum.toFixed(2)}`;

    const dealPriceEl = document.getElementById("combo-deal-price");
    if (dealPriceEl) dealPriceEl.textContent = `${pos.settings.currency}${dealPrice.toFixed(2)}`;

    const savingsPill = document.getElementById("combo-savings-pill");
    if (savingsPill) {
      savingsPill.textContent = savings > 0 ? `Save ${pos.settings.currency}${savings.toFixed(2)} (${pct}% OFF)` : `No Discount`;
    }
  }

  window.updateComboItemQty = (idx, delta) => {
    if (comboItemsList[idx]) {
      comboItemsList[idx].qty = Math.max(1, (comboItemsList[idx].qty || 1) + delta);
      renderComboItemsDOM();
    }
  };

  window.removeComboItem = (idx) => {
    comboItemsList.splice(idx, 1);
    renderComboItemsDOM();
  };

  document.getElementById("combo-add-item-btn")?.addEventListener("click", () => {
    const sel = document.getElementById("combo-item-select");
    const prodId = sel.value;
    if (!prodId) return;

    const prod = pos.products.find(p => p.id === prodId);
    if (prod) {
      const existing = comboItemsList.find(ci => ci.productId === prod.id);
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
      } else {
        comboItemsList.push({
          productId: prod.id,
          name: prod.name,
          qty: 1,
          defaultPrice: prod.price
        });
      }
      renderComboItemsDOM();
      showToast(`Added "${prod.name}" to combo`, "info", "fastfood");
    }
  });

  isComboToggle?.addEventListener("change", (e) => {
    isComboState = e.target.checked;
    if (isComboState) {
      comboSection?.classList.remove("hidden");
      comboTagEl?.classList.remove("hidden");
      if (!catInput.value || catInput.value === "Beverages") {
        const comboCat = pos.categories.find(c => c.toLowerCase().includes("combo") || c.toLowerCase().includes("special"));
        if (comboCat) catInput.value = comboCat;
      }
      renderComboItemsDOM();
    } else {
      comboSection?.classList.add("hidden");
      comboTagEl?.classList.add("hidden");
    }
  });

  function updateLivePreview() {
    document.getElementById("preview-name").textContent = nameInput.value || "Product Name";
    document.getElementById("preview-price").textContent = `${pos.settings.currency}${parseFloat(priceInput.value || 0).toFixed(2)}`;
    document.getElementById("preview-cat").textContent = catInput.value;
    document.getElementById("pm-live-preview").style.backgroundColor = selectedColor;

    const imgContainer = document.getElementById("preview-img-container");
    if (currentImageSrc) {
      imgContainer.innerHTML = `
        <img id="preview-photo" src="${currentImageSrc}" class="w-full h-full object-cover" />
        <div id="preview-combo-tag" class="absolute top-1 right-1 px-1.5 py-0.2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[8px] rounded uppercase ${isComboState ? '' : 'hidden'}">
          COMBO
        </div>
      `;
      clearImgBtn?.classList.remove("hidden");
    } else {
      imgContainer.innerHTML = `
        <span class="material-symbols-outlined text-[36px]" id="preview-icon">${selectedIcon}</span>
        <div id="preview-combo-tag" class="absolute top-1 right-1 px-1.5 py-0.2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[8px] rounded uppercase ${isComboState ? '' : 'hidden'}">
          COMBO
        </div>
      `;
      clearImgBtn?.classList.add("hidden");
    }

    if (isComboState) {
      renderComboItemsDOM();
    }
  }

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        currentImageSrc = event.target.result;
        imgUrlInput.value = "";
        updateLivePreview();
        showToast("Photo loaded from device", "success", "check");
      };
      reader.readAsDataURL(file);
    }
  });

  imgUrlInput?.addEventListener("input", () => {
    currentImageSrc = imgUrlInput.value.trim();
    updateLivePreview();
  });

  clearImgBtn?.addEventListener("click", () => {
    currentImageSrc = "";
    imgUrlInput.value = "";
    fileInput.value = "";
    updateLivePreview();
  });

  nameInput?.addEventListener("input", updateLivePreview);
  priceInput?.addEventListener("input", updateLivePreview);
  catInput?.addEventListener("change", updateLivePreview);

  const portionsToggle = document.getElementById("pm-has-portions-toggle");
  const portionsSection = document.getElementById("pm-portions-section");
  const quarterInput = document.getElementById("pm-quarter-price");
  const halfInput = document.getElementById("pm-half-price");
  const fullInput = document.getElementById("pm-full-price");

  portionsToggle?.addEventListener("change", (e) => {
    if (e.target.checked) {
      portionsSection?.classList.remove("hidden");
      const p = parseFloat(priceInput.value) || 100;
      if (!quarterInput.value || quarterInput.value === "0") quarterInput.value = Math.round(p * 0.35);
      if (!halfInput.value || halfInput.value === "0") halfInput.value = Math.round(p * 0.6);
      if (!fullInput.value || fullInput.value === "0") fullInput.value = p;
    } else {
      portionsSection?.classList.add("hidden");
    }
  });

  let portionsAutoSet = isEditing && hasPortionsInitial;
  nameInput?.addEventListener("input", () => {
    const val = (nameInput.value || "").toLowerCase();
    const isPortionName = val.includes("pizza") || val.includes("sweet corn") || val.includes("corn");
    if (isPortionName && !portionsAutoSet && portionsToggle && !portionsToggle.checked) {
      portionsAutoSet = true;
      portionsToggle.checked = true;
      portionsToggle.dispatchEvent(new Event("change"));
    }
  });

  document.querySelectorAll(".pm-icon-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".pm-icon-btn").forEach(b => b.classList.replace("bg-primary", "bg-surface"));
      document.querySelectorAll(".pm-icon-btn").forEach(b => b.classList.replace("text-on-primary", "text-on-surface"));
      btn.classList.replace("bg-surface", "bg-primary");
      btn.classList.replace("text-on-surface", "text-on-primary");
      selectedIcon = btn.dataset.icon;
      updateLivePreview();
    };
  });

  document.querySelectorAll(".pm-color-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".pm-color-btn").forEach(b => b.classList.replace("border-primary", "border-transparent"));
      btn.classList.replace("border-transparent", "border-primary");
      selectedColor = btn.dataset.color;
      updateLivePreview();
    };
  });

  if (isComboState) {
    renderComboItemsDOM();
  }

  document.getElementById("save-product-modal-btn")?.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value) || 0.00;
    const costPrice = parseFloat(costInput?.value) || (price * 0.4);
    const stock = parseInt(stockInput?.value) || 50;
    const category = catInput.value;
    const sku = document.getElementById("pm-sku").value.trim() || `SKU-${Math.floor(100 + Math.random() * 900)}`;
    const defaultModifier = document.getElementById("pm-modifier").value.trim();

    if (!name) {
      showToast("Please provide a product name", "error", "error");
      return;
    }

    if (isComboState && comboItemsList.length === 0) {
      showToast("Please add at least 1 item to this combo meal", "error", "error");
      return;
    }

    const hasPortions = portionsToggle?.checked || false;
    const quarterPrice = parseFloat(quarterInput?.value) || 0;
    const halfPrice = parseFloat(halfInput?.value) || 0;
    const fullPrice = parseFloat(fullInput?.value) || price;

    const portions = hasPortions ? {
      hasPortions: true,
      quarterPrice,
      halfPrice,
      fullPrice
    } : null;

    const payload = {
      name,
      price,
      costPrice,
      stock,
      category,
      sku,
      defaultModifier,
      img: currentImageSrc,
      fallbackIcon: selectedIcon,
      color: selectedColor,
      isCombo: isComboState,
      comboItems: isComboState ? comboItemsList : [],
      portions: portions
    };

    if (isEditing) {
      pos.updateProduct(productId, payload);
      showToast(`Updated "${name}"`, "success", "check");
    } else {
      pos.addProduct(payload);
      showToast(`Added "${name}" to menu`, "success", "add_circle");
    }

    closeModal();
  });
}

function openCloudSyncModal() {
  const modal = document.getElementById("general-modal");
  if (!modal) return;

  const currentOrigin = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "https://mgn-pos.vercel.app";
  const currentRoom = (cloudSync?.roomCode || pos.settings.syncRoomCode || "MGN-CAFE-MAIN").toUpperCase();
  const kitchenUrl = `${currentOrigin}?room=${encodeURIComponent(currentRoom)}&role=kitchen`;
  const posUrl = `${currentOrigin}?room=${encodeURIComponent(currentRoom)}&role=dashboard`;

  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-3xl shadow-2xl max-w-xl w-full mx-2 sm:mx-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <span class="material-symbols-outlined text-[24px]">cloud_sync</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-headline-lg text-base font-extrabold text-on-surface">Multi-Device Cloud Live Sync</h3>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${cloudSync && cloudSync.isConnected ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-800'}">
                ${cloudSync && cloudSync.isConnected ? '● Connected' : '○ Connecting...'}
              </span>
            </div>
            <p class="text-[11.5px] text-on-surface-variant">Real-time sync between POS Counter Tablet & Kitchen Cooking Tablet</p>
          </div>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- Store Pairing Code Input -->
      <div class="p-4 bg-surface rounded-2xl border border-outline-variant/30 flex flex-col gap-2.5 shadow-xs">
        <label class="font-label-bold text-xs text-on-surface font-bold flex items-center gap-1.5">
          <span class="material-symbols-outlined text-primary text-[16px]">vpn_key</span>
          Store Cloud Sync Channel / Room Code
        </label>
        <div class="flex gap-2">
          <input 
            id="sync-room-input" 
            class="flex-1 h-11 px-4 rounded-xl bg-surface-container border border-outline-variant text-on-surface font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-primary uppercase tracking-wider" 
            value="${currentRoom}" 
            placeholder="e.g. MGN-CAFE-MAIN"
          />
          <button 
            onclick="updateStoreSyncRoom()"
            class="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-bold text-xs shadow-sm hover:bg-primary/90 transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-[16px]">sync</span>
            Pair / Reconnect
          </button>
        </div>
        <p class="text-[11px] text-on-surface-variant">Both POS and Kitchen screens must use the exact same room code to sync live.</p>
      </div>

      <!-- Direct Menu Cloud Upload & Download Card -->
      <div class="p-4 bg-surface rounded-2xl border border-primary/30 flex flex-col gap-3 shadow-xs">
        <div class="flex items-center justify-between">
          <label class="font-label-bold text-xs text-on-surface font-bold flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-[18px]">cloud_sync</span>
            Menu Items Sync (${pos.products.length} items on this device)
          </label>
        </div>
        <p class="text-[11px] text-on-surface-variant">
          Click <b>"Upload Menu to Cloud"</b> on Device 1 to push all items. Then on Device 2, click <b>"Pull Menu from Cloud"</b> to download them!
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button 
            type="button"
            onclick="cloudSync.uploadAllData()"
            class="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[18px]">cloud_upload</span>
            Upload Menu to Cloud (${pos.products.length})
          </button>
          <button 
            type="button"
            onclick="cloudSync.requestFullSync()"
            class="h-11 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-label-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[18px]">cloud_download</span>
            Pull Menu from Cloud
          </button>
        </div>
        <!-- Quick Copy/Paste Share Backup -->
        <div class="flex items-center gap-2 pt-1 border-t border-outline-variant/20 flex-wrap sm:flex-nowrap">
          <button 
            type="button"
            onclick="copyMenuShareCode()"
            class="flex-1 h-9 px-3 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface font-label-bold text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            title="Copy menu data to paste on another phone"
          >
            <span class="material-symbols-outlined text-[15px]">content_copy</span>
            Copy Menu Code
          </button>
          <button 
            type="button"
            onclick="promptImportMenuCode()"
            class="flex-1 h-9 px-3 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface font-label-bold text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            title="Paste menu code from Device 1"
          >
            <span class="material-symbols-outlined text-[15px]">file_download</span>
            Paste / Import Menu Code
          </button>
        </div>
      </div>

      <!-- Device Pairing Tabs / QR Codes -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Kitchen Tablet Pairing Card -->
        <div class="p-4 bg-surface rounded-2xl border border-primary/30 flex flex-col gap-3 shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-amber-600 text-[20px]">soup_kitchen</span>
            <span class="font-headline-md text-xs font-bold text-on-surface">1. Kitchen Cooking Screen</span>
          </div>
          <div id="kitchen-qr-box" class="w-36 h-36 mx-auto bg-white p-2 rounded-xl flex items-center justify-center border border-outline-variant/30 shadow-xs"></div>
          <p class="text-[11px] text-center text-on-surface-variant">Scan on Kitchen Tablet with camera to open live cooking screen</p>
          <button 
            onclick="copyPairLink('${kitchenUrl}', 'Kitchen Screen URL copied!')"
            class="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-bold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[15px]">content_copy</span>
            Copy Kitchen Link
          </button>
        </div>

        <!-- POS Counter Tablet Pairing Card -->
        <div class="p-4 bg-surface rounded-2xl border border-outline-variant/30 flex flex-col gap-3 shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">point_of_sale</span>
            <span class="font-headline-md text-xs font-bold text-on-surface">2. POS Counter Register</span>
          </div>
          <div id="pos-qr-box" class="w-36 h-36 mx-auto bg-white p-2 rounded-xl flex items-center justify-center border border-outline-variant/30 shadow-xs"></div>
          <p class="text-[11px] text-center text-on-surface-variant">Scan on 2nd Cashier Tablet/Phone to open linked billing register</p>
          <button 
            onclick="copyPairLink('${posUrl}', 'POS Terminal URL copied!')"
            class="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-bold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[15px]">content_copy</span>
            Copy POS Link
          </button>
        </div>
      </div>

      <!-- Live Sync Test & Status Footer -->
      <div class="flex items-center justify-between pt-2 border-t border-outline-variant/20">
        <button 
          onclick="testLiveCloudSyncPing()"
          class="h-10 px-4 rounded-xl border border-outline-variant text-on-surface font-label-bold text-xs hover:bg-surface-variant flex items-center gap-1.5 transition-all active:scale-95"
        >
          <span class="material-symbols-outlined text-[16px] text-primary">wifi_tethering</span>
          Send Test Ping (Sound Check)
        </button>
        <button 
          onclick="closeModal()" 
          class="h-10 px-6 rounded-xl bg-primary text-on-primary font-label-bold text-xs shadow-sm hover:bg-primary/90 transition-all active:scale-95"
        >
          Done
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  // Render QR Codes using QRCode library or fallback img
  setTimeout(() => {
    try {
      const kBox = document.getElementById("kitchen-qr-box");
      const pBox = document.getElementById("pos-qr-box");
      if (typeof QRCode !== "undefined") {
        if (kBox) {
          kBox.innerHTML = "";
          new QRCode(kBox, { text: kitchenUrl, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
        }
        if (pBox) {
          pBox.innerHTML = "";
          new QRCode(pBox, { text: posUrl, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
        }
      } else {
        if (kBox) kBox.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(kitchenUrl)}" class="w-32 h-32" />`;
        if (pBox) pBox.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(posUrl)}" class="w-32 h-32" />`;
      }
    } catch (e) {
      console.warn("QR Render error:", e);
    }
  }, 50);
}

function updateStoreSyncRoom() {
  const input = document.getElementById("sync-room-input");
  if (!input) return;
  const newRoom = input.value.trim();
  if (newRoom && typeof cloudSync !== "undefined") {
    cloudSync.setRoomCode(newRoom);
    openCloudSyncModal();
  }
}

function copyPairLink(link, toastMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast(toastMsg || "Link copied to clipboard!", "success", "content_copy");
    }).catch(() => {
      prompt("Copy this URL and open it on your second device:", link);
    });
  } else {
    prompt("Copy this URL and open it on your second device:", link);
  }
}

function copyMenuShareCode() {
  const data = JSON.stringify({
    type: "MGN_MENU_EXPORT",
    version: 1,
    products: pos.products,
    categories: pos.categories,
    settings: { taxRate: pos.settings.taxRate, currency: pos.settings.currency }
  });
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data).then(() => {
      showToast(`📋 Copied ${pos.products.length} menu items! Open this modal on Device 2 and click 'Paste / Import'.`, "success", "content_copy");
    }).catch(() => {
      prompt("Copy this menu data text and send/paste on the other phone:", data);
    });
  } else {
    prompt("Copy this menu data text and send/paste on the other phone:", data);
  }
}

function promptImportMenuCode() {
  const code = prompt("Paste the Menu Share Code from Device 1 here:");
  if (code && code.trim()) {
    try {
      const parsed = JSON.parse(code.trim());
      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        pos.products = parsed.products;
        pos.saveProducts();
        if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
          parsed.categories.forEach(c => {
            if (!pos.categories.includes(c)) pos.categories.push(c);
          });
          pos.saveCategories();
        }
        if (parsed.settings) {
          pos.settings = { ...pos.settings, ...parsed.settings };
          pos.saveSettings();
        }
        if (typeof cloudSync !== "undefined" && cloudSync.isConnected) {
          cloudSync.uploadAllData();
        }
        renderApp();
        showToast(`✅ Successfully imported ${pos.products.length} menu items!`, "success", "check_circle");
        closeModal();
      } else {
        showToast("No products found in pasted code", "error", "error");
      }
    } catch (e) {
      showToast("Invalid menu code format. Please copy and paste accurately.", "error", "error");
    }
  }
}

function openShareMenuQRModal() {
  const modal = document.getElementById("general-modal");
  if (!modal) return;

  let originToUse = "http://192.168.1.9:5500/";
  if (typeof window !== "undefined") {
    let host = window.location.host;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      host = `192.168.1.9:${window.location.port || 5500}`;
    }
    originToUse = `${window.location.protocol}//${host}${window.location.pathname}`;
  }

  const menuPayload = {
    products: getSanitizedProductsForSync(pos.products),
    categories: pos.categories,
    settings: { taxRate: pos.settings.taxRate, currency: pos.settings.currency }
  };
  const jsonStr = JSON.stringify(menuPayload);
  let shareUrl = originToUse;
  try {
    const base64Data = btoa(encodeURIComponent(jsonStr));
    shareUrl = `${originToUse}?importMenu=${base64Data}`;
  } catch (e) {
    shareUrl = originToUse;
  }

  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full mx-2 sm:mx-auto p-5 sm:p-6 flex flex-col gap-4 animate-fade-in-up border border-outline-variant/30 my-auto">
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-800 flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]">qr_code_2</span>
          </div>
          <div>
            <h3 class="font-headline-lg text-base font-extrabold text-on-surface">Share Menu to Phone 2</h3>
            <p class="text-[11.5px] text-on-surface-variant">${pos.products.length} Menu items ready to transfer</p>
          </div>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div class="p-4 bg-surface rounded-2xl border border-outline-variant/30 flex flex-col items-center gap-3 shadow-xs">
        <div id="share-menu-qr-box" class="w-48 h-48 bg-white p-2 rounded-xl flex items-center justify-center border border-outline-variant/30 shadow-xs"></div>
        <div class="text-center">
          <p class="text-xs font-bold text-on-surface">Scan with Phone 2's Camera</p>
          <p class="text-[11px] text-on-surface-variant mt-0.5">Tapping the link on Phone 2 will instantly import all ${pos.products.length} items!</p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <button 
          onclick="copyPairLink('${shareUrl}', 'Direct transfer link copied! Send via WhatsApp to Phone 2.')"
          class="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span class="material-symbols-outlined text-[18px]">share</span>
          Copy Direct Transfer Link
        </button>
        <div class="flex gap-2">
          <button 
            onclick="copyMenuShareCode()"
            class="flex-1 h-10 px-3 rounded-xl border border-outline-variant bg-surface text-on-surface font-label-bold text-xs flex items-center justify-center gap-1.5 hover:bg-surface-container active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">content_copy</span>
            Copy Code
          </button>
          <button 
            onclick="openImportMenuModal()"
            class="flex-1 h-10 px-3 rounded-xl border border-outline-variant bg-surface text-on-surface font-label-bold text-xs flex items-center justify-center gap-1.5 hover:bg-surface-container active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">file_download</span>
            Paste / Import
          </button>
        </div>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  setTimeout(() => {
    try {
      const qrBox = document.getElementById("share-menu-qr-box");
      if (typeof QRCode !== "undefined" && qrBox) {
        qrBox.innerHTML = "";
        new QRCode(qrBox, { text: shareUrl, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.L });
      } else if (qrBox) {
        qrBox.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}" class="w-44 h-44" />`;
      }
    } catch (e) {
      console.warn("QR generation error:", e);
    }
  }, 50);
}

function openImportMenuModal() {
  const modal = document.getElementById("general-modal");
  if (!modal) return;

  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full mx-2 sm:mx-auto p-5 sm:p-6 flex flex-col gap-4 animate-fade-in-up border border-outline-variant/30 my-auto">
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]">file_download</span>
          </div>
          <div>
            <h3 class="font-headline-lg text-base font-extrabold text-on-surface">Import Menu into this Phone</h3>
            <p class="text-[11.5px] text-on-surface-variant">Paste the menu code from Device 1</p>
          </div>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-on-surface">Paste Menu Code Here:</label>
        <textarea 
          id="import-menu-textarea" 
          rows="5" 
          class="w-full p-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-mono text-xs outline-none focus:ring-2 focus:ring-primary"
          placeholder="Paste the code copied from Device 1 here..."
        ></textarea>
      </div>

      <div class="flex gap-2 pt-2 border-t border-outline-variant/20">
        <button onclick="closeModal()" class="flex-1 h-11 rounded-xl border border-outline-variant text-on-surface font-label-bold text-xs">
          Cancel
        </button>
        <button 
          id="do-import-btn"
          onclick="executeImportFromTextarea()"
          class="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label-bold text-xs shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <span class="material-symbols-outlined text-[18px]">check_circle</span>
          Import Menu Now
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
  setTimeout(() => document.getElementById("import-menu-textarea")?.focus(), 100);
}

function executeImportFromTextarea() {
  const text = document.getElementById("import-menu-textarea")?.value.trim();
  if (!text) {
    showToast("Please paste the menu code first", "error", "error");
    return;
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.products) && parsed.products.length > 0) {
      pos.products = parsed.products;
      pos.saveProducts();
      if (Array.isArray(parsed.categories)) {
        parsed.categories = [...new Set([...pos.categories, ...parsed.categories])];
        pos.saveCategories();
      }
      if (parsed.settings) {
        pos.settings = { ...pos.settings, ...parsed.settings };
        pos.saveSettings();
      }
      if (typeof cloudSync !== "undefined" && cloudSync.isConnected) {
        cloudSync.uploadAllData();
      }
      renderApp();
      closeModal();
      showToast(`✅ Successfully imported ${pos.products.length} menu items!`, "success", "check_circle", 5000);
    } else {
      showToast("No items found in pasted data", "error", "error");
    }
  } catch (e) {
    showToast("Invalid code format. Please copy full code from Device 1.", "error", "error");
  }
}

function openPortionSelectionModal(productId, cardElement = null) {
  const product = pos.products.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById("general-modal");
  if (!modal) return;

  const prices = getPortionPrices(product);
  const isPizza = (product.name || "").toLowerCase().includes("pizza") || (product.category || "").toLowerCase().includes("pizza");

  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full mx-2 sm:mx-auto p-5 sm:p-6 flex flex-col gap-4 animate-fade-in-up border border-outline-variant/30 my-auto">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl overflow-hidden bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant/30 shadow-xs">
            ${product.img ? `
              <img src="${product.img}" class="w-full h-full object-cover" />
            ` : `
              <span class="material-symbols-outlined text-[28px] text-primary">${product.fallbackIcon || (isPizza ? 'local_pizza' : 'grain')}</span>
            `}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-headline-lg text-base sm:text-lg font-bold text-on-surface">${product.name}</h3>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase">${product.category}</span>
            </div>
            <p class="text-xs text-on-surface-variant font-medium">Select portion size for order:</p>
          </div>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-colors">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <!-- 3 Portion Cards: Quarter / Half / Full -->
      <div class="grid grid-cols-3 gap-2.5 sm:gap-3 my-1">
        <!-- 1. Quarter Card -->
        <div 
          onclick="selectPortionAndAdd('${product.id}', 'Quarter', ${prices.quarter})"
          class="group relative bg-surface border-2 border-outline-variant/40 hover:border-amber-500 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 active:scale-95 select-none"
        >
          <div class="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-[26px] sm:text-[30px]">${isPizza ? 'pie_chart' : 'grain'}</span>
          </div>
          <span class="font-bold text-xs sm:text-sm text-on-surface">Quarter</span>
          <span class="text-[10px] sm:text-[11px] text-on-surface-variant mb-2 font-medium">1/4 Portion</span>
          <div class="w-full py-1.5 sm:py-2 rounded-xl bg-surface-container group-hover:bg-amber-600 group-hover:text-white transition-colors font-extrabold text-sm sm:text-base text-amber-700">
            ${pos.settings.currency}${prices.quarter.toFixed(2)}
          </div>
          <span class="text-[10px] font-bold text-on-surface-variant mt-2 group-hover:text-amber-700 flex items-center gap-0.5">
            <span class="material-symbols-outlined text-[13px]">add</span>
            Add
          </span>
        </div>

        <!-- 2. Half Card -->
        <div 
          onclick="selectPortionAndAdd('${product.id}', 'Half', ${prices.half})"
          class="group relative bg-surface border-2 border-outline-variant/40 hover:border-orange-500 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 active:scale-95 select-none"
        >
          <div class="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-orange-500/10 text-orange-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-[26px] sm:text-[30px]">${isPizza ? 'pie_chart' : 'grain'}</span>
          </div>
          <span class="font-bold text-xs sm:text-sm text-on-surface">Half</span>
          <span class="text-[10px] sm:text-[11px] text-on-surface-variant mb-2 font-medium">1/2 Portion</span>
          <div class="w-full py-1.5 sm:py-2 rounded-xl bg-surface-container group-hover:bg-orange-600 group-hover:text-white transition-colors font-extrabold text-sm sm:text-base text-orange-700">
            ${pos.settings.currency}${prices.half.toFixed(2)}
          </div>
          <span class="text-[10px] font-bold text-on-surface-variant mt-2 group-hover:text-orange-700 flex items-center gap-0.5">
            <span class="material-symbols-outlined text-[13px]">add</span>
            Add
          </span>
        </div>

        <!-- 3. Full Card -->
        <div 
          onclick="selectPortionAndAdd('${product.id}', 'Full', ${prices.full})"
          class="group relative bg-surface border-2 border-outline-variant/40 hover:border-emerald-500 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 active:scale-95 select-none"
        >
          <div class="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-[26px] sm:text-[30px]">${isPizza ? 'local_pizza' : 'grain'}</span>
          </div>
          <span class="font-bold text-xs sm:text-sm text-on-surface">Full</span>
          <span class="text-[10px] sm:text-[11px] text-on-surface-variant mb-2 font-medium">Full Size</span>
          <div class="w-full py-1.5 sm:py-2 rounded-xl bg-surface-container group-hover:bg-emerald-600 group-hover:text-white transition-colors font-extrabold text-sm sm:text-base text-emerald-700">
            ${pos.settings.currency}${prices.full.toFixed(2)}
          </div>
          <span class="text-[10px] font-bold text-on-surface-variant mt-2 group-hover:text-emerald-700 flex items-center gap-0.5">
            <span class="material-symbols-outlined text-[13px]">add</span>
            Add
          </span>
        </div>
      </div>

      <!-- Bottom Buttons -->
      <div class="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
        <button onclick="closeModal()" class="h-10 px-5 rounded-xl border border-outline-variant text-on-surface font-label-bold text-xs hover:bg-surface-variant transition-colors">
          Cancel
        </button>
        <button onclick="selectPortionAndProceed('${product.id}')" class="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-bold text-xs hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-1.5 shadow-md">
          <span class="material-symbols-outlined text-[15px]">shopping_bag</span>
          Proceed to Payment
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
}

window.selectPortionAndAdd = (productId, portionName, price) => {
  const product = pos.products.find(p => p.id === productId);
  if (!product) return;
  pos.addToCart(product, portionName, null, price);
  closeModal();
  showToast(`Added ${product.name} (${portionName}) · ${pos.settings.currency}${price.toFixed(2)}`, "success", "check");
};

window.selectPortionAndProceed = (productId) => {
  const prices = getPortionPrices(pos.products.find(p => p.id === productId));
  selectPortionAndAdd(productId, 'Full', prices.full);
  setTimeout(() => setRoute('payment-method'), 100);
};

function testLiveCloudSyncPing() {
  if (typeof cloudSync !== "undefined") {
    cloudSync.publish("ping", { type: "PING_TEST", senderRole: pos.currentRoute === "kitchen" ? "Kitchen Screen" : "POS Counter" });
    showToast("📡 Test ping broadcasted to all paired devices!", "info", "wifi");
    if (typeof playOrderReadyChime === "function") {
      playOrderReadyChime();
    }
  }
}

function openHoldOrderModal() {
  if (pos.cart.length === 0) {
    showToast("Cart is empty. Add items to hold order.", "error", "error");
    return;
  }

  const defaultRef = `Token #${pos.heldOrders.length + 1}`;
  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full mx-2 sm:mx-auto p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center pb-2 border-b border-outline-variant/20">
        <h3 class="font-headline-lg text-lg font-bold text-on-surface flex items-center gap-2">
          <span class="material-symbols-outlined text-amber-600 text-[24px]">pause_circle</span>
          Hold Active Order (Park)
        </h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <p class="text-xs text-on-surface-variant">
        This order will be held safely in the background. You can immediately punch next customer orders and resume this order anytime.
      </p>

      <div class="flex flex-col gap-1.5">
        <label class="font-label-bold text-xs text-on-surface font-bold">Table / Token / Reference Name *</label>
        <input 
          id="hold-reference-input" 
          type="text" 
          class="h-11 px-3.5 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary font-bold" 
          value="${defaultRef}" 
          placeholder="e.g. Table 4 / Token #12 / Ramesh..."
        />
      </div>

      <div class="p-3 bg-surface-container rounded-xl flex flex-col gap-1 text-xs">
        <div class="flex justify-between text-on-surface-variant">
          <span>Items in Cart:</span>
          <strong class="text-on-surface">${pos.getItemCount()} items (${pos.cart.map(i => `${i.qty}x ${i.name}`).slice(0, 2).join(', ')}${pos.cart.length > 2 ? '...' : ''})</strong>
        </div>
        <div class="flex justify-between text-on-surface-variant">
          <span>Order Total:</span>
          <strong class="text-primary font-headline-md">${pos.settings.currency}${pos.getTotalDue().toFixed(2)}</strong>
        </div>
      </div>

      <div class="flex gap-3 pt-2 border-t border-outline-variant/20">
        <button onclick="closeModal()" class="flex-1 h-11 rounded-xl border border-outline-variant font-label-bold text-on-surface">Cancel</button>
        <button id="confirm-hold-order-btn" class="flex-1 h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-label-bold shadow-md active:scale-95 flex items-center justify-center gap-1.5">
          <span class="material-symbols-outlined text-[18px]">pause_circle</span>
          Hold Order Now
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  document.getElementById("confirm-hold-order-btn")?.addEventListener("click", () => {
    const refInput = document.getElementById("hold-reference-input").value.trim() || defaultRef;
    const held = pos.holdCurrentOrder(refInput);
    closeModal();
    if (held) {
      showToast(`Order parked as "${held.reference}" — Ready for next order!`, "info", "pause_circle");
    }
  });
}

function openHeldOrdersModal() {
  const modal = document.getElementById("general-modal");
  if (!pos.heldOrders || pos.heldOrders.length === 0) {
    showToast("No orders are currently on hold", "info", "info");
    return;
  }

  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-xl w-full mx-2 sm:mx-auto p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center pb-2 border-b border-outline-variant/20">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-amber-600 text-[24px]">pause_circle</span>
          <div>
            <h3 class="font-headline-lg text-lg font-bold text-on-surface">Held Orders Queue</h3>
            <p class="text-[11px] text-on-surface-variant">${pos.heldOrders.length} parked order(s) waiting</p>
          </div>
        </div>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
        ${pos.heldOrders.map((held) => {
          const elapsedMins = Math.floor((Date.now() - new Date(held.timestamp).getTime()) / 60000);
          const timeText = elapsedMins <= 0 ? 'Just now' : `${elapsedMins} min${elapsedMins > 1 ? 's' : ''} ago`;
          return `
            <div class="p-3.5 bg-surface-container rounded-2xl border border-outline-variant/30 flex flex-col gap-2.5 hover:shadow-sm transition-all">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 text-xs font-black uppercase tracking-wider">${held.reference}</span>
                  <span class="text-xs text-on-surface-variant flex items-center gap-1 font-semibold">
                    <span class="material-symbols-outlined text-[14px]">schedule</span> ${timeText}
                  </span>
                </div>
                <span class="font-display text-base font-extrabold text-primary">${pos.settings.currency}${held.total.toFixed(2)}</span>
              </div>

              <div class="flex items-center justify-between text-xs text-on-surface-variant bg-surface p-2 rounded-xl border border-outline-variant/20">
                <div class="flex items-center gap-1.5 truncate flex-1">
                  <span class="material-symbols-outlined text-[15px] text-primary">person</span>
                  <span class="font-bold text-on-surface">${held.customer?.name || 'Walk-in'}</span>
                  <span class="text-on-surface-variant">· ${held.itemCount} item(s)</span>
                </div>
                <div class="flex items-center gap-1 shrink-0 font-medium text-[11px] text-on-surface-variant/80">
                  ${held.items.map(i => `${i.qty}x ${i.name}`).slice(0, 3).join(', ')}${held.items.length > 3 ? '...' : ''}
                </div>
              </div>

              <div class="flex items-center gap-2 pt-1 border-t border-outline-variant/20">
                <button 
                  onclick="confirmRecallHeldOrder('${held.id}')"
                  class="flex-1 h-9 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-label-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <span class="material-symbols-outlined text-[16px]">play_circle</span>
                  Recall / Resume Order
                </button>
                <button 
                  onclick="confirmDeleteHeldOrder('${held.id}', '${escape(held.reference)}')"
                  class="h-9 px-3 rounded-xl bg-error-container/40 hover:bg-error-container text-on-error-container font-label-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95"
                  title="Discard Held Order"
                >
                  <span class="material-symbols-outlined text-[16px]">delete</span>
                  Discard
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
}

function confirmRecallHeldOrder(heldOrderId) {
  if (pos.cart.length > 0) {
    if (!confirm("Your active cart already has items. Do you want to replace current cart with this held order?")) {
      return;
    }
  }
  const recalled = pos.recallHeldOrder(heldOrderId);
  closeModal();
  if (recalled) {
    showToast(`Resumed "${recalled.reference}" order!`, "success", "play_circle");
  }
}

function confirmDeleteHeldOrder(heldOrderId, encodedRef) {
  const refName = unescape(encodedRef);
  if (confirm(`Are you sure you want to discard held order "${refName}"?`)) {
    pos.deleteHeldOrder(heldOrderId);
    if (pos.heldOrders.length > 0) {
      openHeldOrdersModal();
    } else {
      closeModal();
    }
    showToast(`Discarded held order "${refName}"`, "info", "delete");
  }
}

function confirmDeleteProduct(productId, encodedName) {
  const name = unescape(encodedName);
  if (confirm(`Are you sure you want to delete "${name}" from the product catalog?`)) {
    pos.deleteProduct(productId);
    showToast(`Deleted "${name}"`, "info", "delete");
  }
}

function openDeleteOrderHistoryModal() {
  const modal = document.getElementById("general-modal");
  if (!modal) return;

  const totalOrders = pos.orders.length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = pos.orders.filter(o => (o.date || o.timestamp || "").slice(0, 10) === todayStr).length;

  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full mx-2 sm:mx-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div class="flex items-center gap-2.5 text-error">
          <div class="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-[20px]">delete_sweep</span>
          </div>
          <div>
            <h3 class="font-headline-lg text-base font-extrabold text-on-surface">Delete Order History</h3>
            <p class="text-[11px] text-on-surface-variant">Manage and remove recorded sales transactions</p>
          </div>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- Warning Note -->
      <div class="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950 font-medium">
        <span class="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">warning</span>
        <span>Deleting order history will clear transaction receipts and analytics sales totals. Your menu catalog, prices, and settings will remain safe.</span>
      </div>

      <!-- Action Options List -->
      <div class="flex flex-col gap-2.5">
        
        <!-- Option 1: Delete All Orders -->
        <button 
          onclick="executeDeleteOrderHistory('all')"
          class="p-3.5 rounded-2xl border border-error/30 hover:bg-error/10 text-left flex items-center justify-between transition-all group active:scale-[0.99]"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-error/15 text-error flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">delete_forever</span>
            </div>
            <div>
              <p class="text-xs font-bold text-on-surface group-hover:text-error">Clear All Order History</p>
              <p class="text-[11px] text-on-surface-variant">Delete all ${totalOrders} saved order receipts permanently</p>
            </div>
          </div>
          <span class="material-symbols-outlined text-[18px] text-error">chevron_right</span>
        </button>

        <!-- Option 2: Delete Today's Orders -->
        <button 
          onclick="executeDeleteOrderHistory('today')"
          class="p-3.5 rounded-2xl border border-outline-variant/30 hover:bg-surface-container-high text-left flex items-center justify-between transition-all group active:scale-[0.99]"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">today</span>
            </div>
            <div>
              <p class="text-xs font-bold text-on-surface">Delete Today's Test Orders (${todayCount} orders)</p>
              <p class="text-[11px] text-on-surface-variant">Remove only bills created today (${new Date().toLocaleDateString('en-IN')})</p>
            </div>
          </div>
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
        </button>

        <!-- Option 3: Delete Orders Older Than 30 Days -->
        <button 
          onclick="executeDeleteOrderHistory('older30')"
          class="p-3.5 rounded-2xl border border-outline-variant/30 hover:bg-surface-container-high text-left flex items-center justify-between transition-all group active:scale-[0.99]"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">history</span>
            </div>
            <div>
              <p class="text-xs font-bold text-on-surface">Delete Orders Older Than 30 Days</p>
              <p class="text-[11px] text-on-surface-variant">Keep last 30 days of sales, archive older records</p>
            </div>
          </div>
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
        </button>

        <!-- Option 4: Delete Orders Older Than 7 Days -->
        <button 
          onclick="executeDeleteOrderHistory('older7')"
          class="p-3.5 rounded-2xl border border-outline-variant/30 hover:bg-surface-container-high text-left flex items-center justify-between transition-all group active:scale-[0.99]"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-surface-variant text-on-surface-variant flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">calendar_view_week</span>
            </div>
            <div>
              <p class="text-xs font-bold text-on-surface">Delete Orders Older Than 7 Days</p>
              <p class="text-[11px] text-on-surface-variant">Keep only this week's sales records</p>
            </div>
          </div>
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
        </button>
      </div>

      <!-- Footer Buttons -->
      <div class="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
        <button 
          onclick="closeModal()" 
          class="h-10 px-5 rounded-xl border border-outline-variant text-on-surface font-label-bold text-xs hover:bg-surface-variant transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
}

function executeDeleteOrderHistory(type) {
  if (type === "all") {
    if (confirm("Are you sure you want to permanently delete ALL sales order history? This cannot be undone.")) {
      pos.clearAllOrders();
      closeModal();
      renderApp();
      showToast("All order sales history cleared!", "info", "delete_forever");
    }
  } else if (type === "today") {
    if (confirm("Delete all orders created today?")) {
      const removed = pos.deleteOrdersToday();
      closeModal();
      renderApp();
      showToast(`Deleted ${removed} orders from today`, "info", "today");
    }
  } else if (type === "older30") {
    if (confirm("Delete orders older than 30 days?")) {
      const removed = pos.deleteOrdersOlderThan(30);
      closeModal();
      renderApp();
      showToast(`Cleaned up ${removed} orders older than 30 days`, "info", "history");
    }
  } else if (type === "older7") {
    if (confirm("Delete orders older than 7 days?")) {
      const removed = pos.deleteOrdersOlderThan(7);
      closeModal();
      renderApp();
      showToast(`Cleaned up ${removed} orders older than 7 days`, "info", "history");
    }
  }
}

function confirmDeleteSingleOrder(orderId, receipt) {
  if (confirm(`Are you sure you want to delete order receipt #${receipt}?`)) {
    const success = pos.deleteOrder(orderId);
    if (success) {
      renderApp();
      showToast(`Deleted order #${receipt}`, "info", "delete");
    }
  }
}

function openAddCategoryModal() {
  const modal = document.getElementById("general-modal");
  if (!modal) return;

  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full mx-2 sm:mx-auto p-4 sm:p-6 flex flex-col gap-4 animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      
      <!-- Header -->
      <div class="flex items-center justify-between pb-2 border-b border-outline-variant/20">
        <div class="flex items-center gap-2 text-primary">
          <span class="material-symbols-outlined text-[24px]">category</span>
          <h3 class="font-headline-lg text-lg font-bold text-on-surface">Categories Manager</h3>
        </div>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Add New Category Field -->
      <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container border border-outline-variant/30">
        <label class="font-label-bold text-xs text-on-surface font-bold flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px] text-primary">add_circle</span>
          Create New Category
        </label>
        <div class="flex gap-2">
          <input 
            id="new-cat-name-input" 
            class="flex-1 h-10 px-3.5 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" 
            placeholder="e.g. Specials, Shakes, Bakery..." 
          />
          <button 
            id="save-new-category-btn" 
            class="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-bold text-xs shrink-0 flex items-center gap-1 shadow-sm active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">add</span>
            Add
          </button>
        </div>
      </div>

      <!-- Existing Categories List with Delete Buttons -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="font-label-bold text-xs text-on-surface-variant font-bold uppercase tracking-wider">
            All Categories (${pos.categories.length})
          </span>
          <span class="text-[10.5px] text-on-surface-variant">Tap trash to delete</span>
        </div>

        <div class="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
          ${pos.categories.map(cat => {
            const isSystem = cat === "All Items";
            const count = pos.products.filter(p => p.category === cat).length;
            return `
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-outline-variant/25 hover:bg-surface-container transition-all">
                <div class="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div class="w-7 h-7 rounded-lg ${isSystem ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'} flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[16px]">${isSystem ? 'auto_awesome' : 'label'}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs text-on-surface truncate">${cat}</span>
                    <span class="text-[10.5px] text-on-surface-variant leading-none mt-0.5">
                      ${isSystem ? 'System master filter' : `${count} item${count === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </div>

                ${isSystem ? `
                  <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">Protected</span>
                ` : `
                  <button 
                    type="button"
                    onclick="executeDeleteCategory('${escape(cat)}')"
                    class="h-8 px-2.5 rounded-lg text-error hover:bg-error/10 border border-error/20 flex items-center gap-1 transition-all active:scale-90 text-xs shrink-0"
                    title="Delete Category '${cat}'"
                  >
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                    <span class="text-[11px] font-bold">Delete</span>
                  </button>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Footer Done Button -->
      <div class="flex justify-end pt-2 border-t border-outline-variant/20">
        <button onclick="closeModal()" class="h-10 px-5 rounded-xl border border-outline-variant font-label-bold text-xs text-on-surface hover:bg-surface-container active:scale-95 transition-all">Done</button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  const inputEl = document.getElementById("new-cat-name-input");
  const saveBtn = document.getElementById("save-new-category-btn");

  const submitNewCategory = () => {
    const catName = inputEl ? inputEl.value.trim() : "";
    if (catName) {
      if (pos.categories.map(c => c.toLowerCase()).includes(catName.toLowerCase())) {
        showToast(`Category "${catName}" already exists`, "error", "error");
        return;
      }
      pos.addCategory(catName);
      showToast(`Added category "${catName}"`, "success", "category");
      openAddCategoryModal(); // Refresh modal in-place so user immediately sees it
    } else {
      showToast("Please enter a category name", "error", "error");
    }
  };

  saveBtn?.addEventListener("click", submitNewCategory);
  inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitNewCategory();
    }
  });
}

function executeDeleteCategory(encodedCat) {
  const catName = unescape(encodedCat);
  if (!catName || catName === "All Items") return;

  const count = pos.products.filter(p => p.category === catName).length;
  const fallback = pos.categories.find(c => c !== "All Items" && c !== catName) || "Beverages";

  let confirmMsg = `Are you sure you want to delete category "${catName}"?`;
  if (count > 0) {
    confirmMsg = `Category "${catName}" has ${count} product(s) in the menu.\n\nDeleting this category will move those ${count} product(s) to "${fallback}". Proceed?`;
  }

  if (confirm(confirmMsg)) {
    const success = pos.deleteCategory(catName, fallback);
    if (success) {
      showToast(`Category "${catName}" deleted`, "info", "delete");
      openAddCategoryModal(); // Re-render modal in-place
    }
  }
}

// ==========================================
// 9. GENERAL DIALOGS (DISCOUNT, NOTE, CUSTOMER, DIGITAL, SPLIT)
// ==========================================

function openDiscountModal() {
  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full mx-2 sm:mx-auto p-4 sm:p-margin-edge flex flex-col gap-stack-md animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center">
        <h3 class="font-headline-lg text-lg sm:text-headline-lg font-bold text-on-surface">Apply Discount</h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined">close</span></button>
      </div>

      <div class="grid grid-cols-2 gap-stack-sm mt-2">
        <button id="disc-10-btn" class="h-13 py-3 rounded-xl bg-surface-container hover:bg-primary hover:text-on-primary font-headline-md text-sm font-bold transition-colors">10% Off</button>
        <button id="disc-20-btn" class="h-13 py-3 rounded-xl bg-surface-container hover:bg-primary hover:text-on-primary font-headline-md text-sm font-bold transition-colors">20% Off</button>
        <button id="disc-50rs-btn" class="h-13 py-3 rounded-xl bg-surface-container hover:bg-primary hover:text-on-primary font-headline-md text-sm font-bold transition-colors">₹50 Flat Off</button>
        <button id="disc-100rs-btn" class="h-13 py-3 rounded-xl bg-surface-container hover:bg-primary hover:text-on-primary font-headline-md text-sm font-bold transition-colors">₹100 Flat Off</button>
      </div>

      <div class="flex flex-col gap-2 mt-2">
        <label class="font-label-bold text-xs text-on-surface-variant font-bold">Custom Fixed Amount (${pos.settings.currency})</label>
        <div class="flex gap-2">
          <input id="custom-fixed-disc-input" type="number" step="10" placeholder="e.g. 75" class="flex-1 h-11 px-4 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" />
          <button id="apply-custom-disc-btn" class="px-5 h-11 bg-primary text-on-primary rounded-xl font-label-bold text-sm">Apply</button>
        </div>
      </div>

      ${pos.discount.type !== 'none' ? `
        <button id="remove-disc-btn" class="w-full h-11 bg-error-container text-on-error-container rounded-xl font-label-bold mt-2">Remove Discount</button>
      ` : ''}
    </div>
  `;
  modal.classList.remove("hidden");

  document.getElementById("disc-10-btn")?.addEventListener("click", () => { pos.discount = { type: 'percent', value: 10 }; closeModal(); updateCartPanelDOM(); showToast("10% discount applied", "success", "percent"); });
  document.getElementById("disc-20-btn")?.addEventListener("click", () => { pos.discount = { type: 'percent', value: 20 }; closeModal(); updateCartPanelDOM(); showToast("20% discount applied", "success", "percent"); });
  document.getElementById("disc-50rs-btn")?.addEventListener("click", () => { pos.discount = { type: 'fixed', value: 50 }; closeModal(); updateCartPanelDOM(); showToast("₹50 discount applied", "success", "sell"); });
  document.getElementById("disc-100rs-btn")?.addEventListener("click", () => { pos.discount = { type: 'fixed', value: 100 }; closeModal(); updateCartPanelDOM(); showToast("₹100 discount applied", "success", "sell"); });
  
  document.getElementById("apply-custom-disc-btn")?.addEventListener("click", () => {
    const val = parseFloat(document.getElementById("custom-fixed-disc-input").value) || 0;
    if (val > 0) {
      pos.discount = { type: 'fixed', value: val };
      closeModal();
      updateCartPanelDOM();
      showToast(`${pos.settings.currency}${val.toFixed(2)} discount applied`, "success", "sell");
    }
  });
  document.getElementById("remove-disc-btn")?.addEventListener("click", () => {
    pos.discount = { type: 'none', value: 0 };
    closeModal();
    updateCartPanelDOM();
    showToast("Discount removed", "info", "close");
  });
}

function openNoteModal() {
  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full mx-2 sm:mx-auto p-4 sm:p-margin-edge flex flex-col gap-stack-md animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <h3 class="font-headline-lg text-lg sm:text-headline-lg font-bold text-on-surface">Order Note</h3>
      <textarea id="order-note-input" rows="3" class="w-full p-3 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. Table #4, Rush order, Pack separately...">${pos.orderNote}</textarea>
      <div class="flex gap-gutter mt-2">
        <button onclick="closeModal()" class="flex-1 h-11 rounded-xl border border-outline-variant font-label-bold text-on-surface">Cancel</button>
        <button id="save-note-btn" class="flex-1 h-11 rounded-xl bg-primary text-on-primary font-label-bold">Save Note</button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  document.getElementById("save-note-btn")?.addEventListener("click", () => {
    pos.orderNote = document.getElementById("order-note-input").value.trim();
    closeModal();
    updateCartPanelDOM();
    showToast("Order note saved", "success", "edit_note");
  });
}

function openCustomerModal() {
  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full mx-2 sm:mx-auto p-4 sm:p-margin-edge flex flex-col gap-stack-md animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <h3 class="font-headline-lg text-lg sm:text-headline-lg font-bold text-on-surface">Customer Details</h3>
      <div class="flex flex-col gap-1">
        <label class="font-label-bold text-xs text-on-surface-variant font-bold">Customer Name</label>
        <input id="cust-name-input" class="h-11 px-4 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm" value="${pos.customer.name === 'Walk-in Customer' ? '' : pos.customer.name}" placeholder="e.g. Rahul Sharma" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-label-bold text-xs text-on-surface-variant font-bold">Phone Number (UPI / SMS Bill)</label>
        <input id="cust-phone-input" class="h-11 px-4 rounded-xl bg-surface border border-outline-variant text-on-surface font-body-md text-sm" value="${pos.customer.phone || ''}" placeholder="+91 98765 00000" />
      </div>
      <div class="flex gap-gutter mt-2">
        <button onclick="pos.customer = { name: 'Walk-in Customer', phone: '' }; closeModal(); updateCartPanelDOM();" class="flex-1 h-11 rounded-xl border border-outline-variant font-label-bold text-on-surface">Walk-in</button>
        <button id="save-customer-btn" class="flex-1 h-11 rounded-xl bg-primary text-on-primary font-label-bold">Save</button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  document.getElementById("save-customer-btn")?.addEventListener("click", () => {
    const name = document.getElementById("cust-name-input").value.trim() || "Walk-in Customer";
    const phone = document.getElementById("cust-phone-input").value.trim();
    pos.customer = { name, phone, id: `CUST-${Math.floor(1000 + Math.random() * 9000)}` };
    closeModal();
    updateCartPanelDOM();
    showToast(`Customer set to ${name}`, "success", "person");
  });
}

function openDigitalPaymentModal() {
  const total = pos.getTotalDue();
  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-lg w-full mx-2 sm:mx-auto p-4 sm:p-margin-edge flex flex-col items-center text-center gap-3 sm:gap-stack-md animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary-container flex items-center justify-center text-on-primary-container mb-1 shadow-sm">
        <span class="material-symbols-outlined text-[30px] sm:text-[36px]">qr_code_2</span>
      </div>

      <h3 class="font-headline-lg text-lg sm:text-headline-lg font-bold text-on-surface">UPI & Digital Payment</h3>
      <p class="font-body-md text-xs sm:text-sm text-on-surface-variant">Scan UPI QR code (GPay, PhonePe, Paytm) or swipe/tap card on customer terminal.</p>

      <div class="my-1 sm:my-2 p-3.5 sm:p-5 bg-surface-container-high rounded-2xl flex flex-col items-center gap-2 sm:gap-2.5 w-full border border-primary/20">
        <div class="w-36 h-36 sm:w-44 sm:h-44 bg-white p-2.5 sm:p-3 rounded-xl shadow-md flex items-center justify-center border-2 border-primary">
          <svg viewBox="0 0 100 100" class="w-full h-full text-on-surface">
            <rect width="100" height="100" fill="white" />
            <path d="M10 10h30v30h-30zM15 15h20v20h-20zM22 22h6v6h-6z" fill="#0058be"/>
            <path d="M60 10h30v30h-30zM65 15h20v20h-20zM72 22h6v6h-6z" fill="#0058be"/>
            <path d="M10 60h30v30h-30zM15 65h20v20h-20zM22 72h6v6h-6z" fill="#0058be"/>
            <rect x="50" y="50" width="10" height="10" fill="#0058be"/>
            <rect x="70" y="60" width="10" height="20" fill="#0058be"/>
            <rect x="80" y="50" width="10" height="10" fill="#0058be"/>
            <rect x="50" y="70" width="20" height="10" fill="#0058be"/>
          </svg>
        </div>
        <span class="font-headline-lg text-xl sm:text-headline-lg text-primary font-bold">${pos.settings.currency}${total.toFixed(2)}</span>
        <span class="font-label-sm text-[11px] sm:text-xs text-on-surface-variant font-medium">UPI ID: ${pos.settings.upiId || 'mgncafe@upi'} · Instant Verification</span>
      </div>

      <div class="flex gap-2 sm:gap-gutter w-full">
        <button onclick="closeModal()" class="flex-1 h-11 sm:h-12 rounded-xl border border-outline-variant font-label-bold text-xs sm:text-sm text-on-surface">Cancel</button>
        <button id="simulate-card-success-btn" class="flex-1 h-11 sm:h-12 rounded-xl bg-secondary text-on-secondary font-headline-md text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-md hover:bg-secondary/90 active:scale-95">
          <span class="material-symbols-outlined text-[18px]">check_circle</span>
          Authorize & Complete
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  document.getElementById("simulate-card-success-btn")?.addEventListener("click", () => {
    closeModal();
    pos.completeOrder("UPI & Digital", { authCode: `UPI-${Math.floor(100000 + Math.random() * 900000)}` });
    setRoute("confirmation");
    showToast("UPI payment received successfully!", "success", "check_circle");
  });
}

function openSplitPaymentModal() {
  const total = pos.getTotalDue();
  let cashPart = (Math.floor(total / 2)).toFixed(2);
  let cardPart = (total - parseFloat(cashPart)).toFixed(2);

  const modal = document.getElementById("general-modal");
  modal.innerHTML = `
    <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-lg w-full mx-2 sm:mx-auto p-4 sm:p-margin-edge flex flex-col gap-3 sm:gap-stack-md animate-fade-in-up border border-outline-variant/30 my-auto max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center">
        <h3 class="font-headline-lg text-headline-lg font-bold text-on-surface">Split Payment</h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined">close</span></button>
      </div>

      <p class="font-body-md text-sm text-on-surface-variant">Total Due: <strong class="text-primary font-headline-md font-bold">${pos.settings.currency}${total.toFixed(2)}</strong></p>

      <div class="flex flex-col gap-stack-md mt-1">
        <div class="p-3 bg-surface-container rounded-xl flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">payments</span>
            <span class="font-label-bold text-sm text-on-surface font-bold">Cash Portion (${pos.settings.currency})</span>
          </div>
          <input id="split-cash-input" type="number" step="10" class="w-32 h-10 px-3 rounded-lg bg-surface border border-outline-variant font-headline-md font-bold text-right text-sm" value="${cashPart}" />
        </div>

        <div class="p-3 bg-surface-container rounded-xl flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">qr_code_2</span>
            <span class="font-label-bold text-sm text-on-surface font-bold">UPI / Card Portion (${pos.settings.currency})</span>
          </div>
          <input id="split-card-input" type="number" step="10" class="w-32 h-10 px-3 rounded-lg bg-surface border border-outline-variant font-headline-md font-bold text-right text-sm" value="${cardPart}" />
        </div>
      </div>

      <div class="flex gap-gutter mt-3">
        <button onclick="closeModal()" class="flex-1 h-12 rounded-xl border border-outline-variant font-label-bold text-on-surface">Cancel</button>
        <button id="confirm-split-btn" class="flex-1 h-12 rounded-xl bg-primary text-on-primary font-headline-md text-sm shadow-md hover:bg-primary/90 active:scale-95">
          Process Split
        </button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");

  const cashInput = document.getElementById("split-cash-input");
  const cardInput = document.getElementById("split-card-input");

  cashInput?.addEventListener("input", () => {
    const val = parseFloat(cashInput.value) || 0;
    cardInput.value = Math.max(0, total - val).toFixed(2);
  });

  document.getElementById("confirm-split-btn")?.addEventListener("click", () => {
    const finalCash = parseFloat(cashInput.value) || 0;
    const finalCard = parseFloat(cardInput.value) || 0;
    closeModal();
    pos.completeOrder("Split Payment", { cashPortion: finalCash, cardPortion: finalCard });
    setRoute("confirmation");
    showToast("Split payment processed successfully!", "success", "call_split");
  });
}

function closeModal() {
  const modal = document.getElementById("general-modal");
  if (modal) modal.classList.add("hidden");
  const clearModal = document.getElementById("clear-all-modal");
  if (clearModal) clearModal.classList.add("hidden");
}

// ==========================================
// 10. THERMAL RECEIPT PRINT ENGINE (RUPEES ₹)
// ==========================================

function printThermalReceipt(orderToPrint = null) {
  const order = orderToPrint || pos.activeTransaction || pos.orders[0];
  if (!order) {
    showToast("No receipt found to print", "error", "error");
    return;
  }

  const printContainer = document.getElementById("thermal-receipt-container");
  if (!printContainer) return;

  const showLogo = pos.settings.showLogoOnReceipt !== false;
  const showGstin = pos.settings.showGstinOnReceipt !== false && !!pos.settings.gstin;
  const showCustomer = pos.settings.showCustomerOnReceipt !== false;
  const widthStyle = pos.settings.paperWidth === "58mm" ? "58mm" : "80mm";

  printContainer.style.width = widthStyle;
  printContainer.style.maxWidth = widthStyle;

  printContainer.innerHTML = `
    <div style="text-align: center; margin-bottom: 8px;">
      ${showLogo ? `<img src="./assets/mgn_logo.png" alt="MGN Logo" style="height: 36px; width: auto; max-width: 140px; margin: 0 auto 6px auto; display: block; object-fit: contain;" onerror="this.style.display='none'" />` : ''}
      <h2 style="font-size: 16px; font-weight: bold; margin: 0;">${pos.settings.storeName.toUpperCase()}</h2>
      <p style="font-size: 11px; margin: 2px 0;">${pos.settings.receiptHeader}</p>
      <p style="font-size: 10px; margin: 2px 0;">${pos.settings.receiptAddress}</p>
      <p style="font-size: 10px; margin: 2px 0;">Tel: ${pos.settings.receiptPhone}</p>
      ${showGstin ? `<p style="font-size: 10px; margin: 2px 0;"><strong>GSTIN:</strong> ${pos.settings.gstin}</p>` : ''}
      ${pos.settings.businessEmail ? `<p style="font-size: 9px; margin: 2px 0;">${pos.settings.businessEmail}</p>` : ''}
      <p style="margin: 4px 0; border-bottom: 1px dashed black;"></p>
    </div>

    <div style="font-size: 11px; margin-bottom: 8px;">
      <div><strong>Receipt #:</strong> ${order.receiptNumber}</div>
      <div><strong>Date:</strong> ${order.displayDate}</div>
      <div><strong>Terminal:</strong> ${order.terminal || pos.settings.terminal} · <strong>Cashier:</strong> ${order.cashier || pos.settings.cashier}</div>
      ${showCustomer ? `<div><strong>Customer:</strong> ${order.customer?.name || 'Walk-in'} ${order.customer?.phone ? `(${order.customer.phone})` : ''}</div>` : ''}
      <p style="margin: 4px 0; border-bottom: 1px dashed black;"></p>
    </div>

    <table style="width: 100%; font-size: 11px; margin-bottom: 8px; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid black;">
          <th style="text-align: left; padding-bottom: 4px;">Item</th>
          <th style="text-align: center; padding-bottom: 4px;">Qty</th>
          <th style="text-align: right; padding-bottom: 4px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map(item => `
          <tr>
            <td style="padding: 2px 0;">${item.name}<br><small style="color: #444;">${item.modifier || ''}</small></td>
            <td style="text-align: center; vertical-align: top;">${item.qty}</td>
            <td style="text-align: right; vertical-align: top;">${pos.settings.currency}${(item.price * item.qty).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="font-size: 11px; margin-bottom: 8px; border-top: 1px dashed black; padding-top: 4px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Subtotal:</span>
        <span>${pos.settings.currency}${order.subtotal.toFixed(2)}</span>
      </div>
      ${order.discount > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Discount:</span>
          <span>-${pos.settings.currency}${order.discount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between;">
        <span>${((order.taxRate !== undefined ? order.taxRate : pos.settings.taxRate) === 0) ? 'Tax (0% Exempt)' : `GST (${order.taxRate !== undefined ? order.taxRate : pos.settings.taxRate}%)`}:</span>
        <span>${pos.settings.currency}${order.tax.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 4px; border-top: 1px solid black; padding-top: 2px;">
        <span>TOTAL:</span>
        <span>${pos.settings.currency}${order.total.toFixed(2)}</span>
      </div>
    </div>

    <div style="font-size: 10px; margin-bottom: 8px; border-top: 1px dashed black; padding-top: 4px;">
      <div><strong>Tender:</strong> ${order.paymentMethod}</div>
      ${order.tenderDetails?.amountReceived ? `<div><strong>Received:</strong> ${pos.settings.currency}${parseFloat(order.tenderDetails.amountReceived).toFixed(2)}</div>` : ''}
      ${order.tenderDetails?.changeDue ? `<div><strong>Change:</strong> ${pos.settings.currency}${parseFloat(order.tenderDetails.changeDue).toFixed(2)}</div>` : ''}
      ${pos.settings.upiId ? `<div><strong>UPI ID:</strong> ${pos.settings.upiId}</div>` : ''}
    </div>

    <div style="text-align: center; font-size: 10px; margin-top: 12px;">
      <p style="margin: 0;">${pos.settings.receiptFooter}</p>
      <p style="margin: 4px 0; font-family: monospace; font-size: 9px;">* * * * * * * * * * * * *</p>
    </div>
  `;

  window.print();
  showToast("Receipt sent to thermal printer", "success", "print");
}

// ==========================================
// 11. EVENT BINDING & EVENT DELEGATION
// ==========================================

function bindProductCardEvents() {
  document.querySelectorAll(".product-card").forEach(card => {
    card.onclick = (e) => {
      if (Date.now() - lastDragEndTime < 250 || isCurrentlyDragging) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const pid = card.dataset.productId;
      const product = pos.products.find(p => p.id === pid);
      if (product) {
        if (isPortionItem(product)) {
          openPortionSelectionModal(product.id, card);
        } else {
          pos.addToCart(product, "", card);
        }
      }
    };
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const pid = card.dataset.productId;
        const product = pos.products.find(p => p.id === pid);
        if (product) {
          if (isPortionItem(product)) {
            openPortionSelectionModal(product.id, card);
          } else {
            pos.addToCart(product, "", card);
          }
        }
      }
    };
  });
}

function bindCartRowEvents() {
  document.querySelectorAll(".cart-increment-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      pos.updateItemQty(btn.dataset.cartId, 1);
    };
  });

  document.querySelectorAll(".cart-decrement-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      pos.updateItemQty(btn.dataset.cartId, -1);
    };
  });

  document.querySelectorAll(".cart-remove-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      pos.removeCartItem(btn.dataset.cartId);
    };
  });
}

function bindEventListeners() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const route = item.dataset.route;
      setRoute(route);
    };
  });

  const searchInput = document.getElementById("product-search-input");
  if (searchInput) {
    searchInput.oninput = (e) => {
      pos.searchQuery = e.target.value;
      updateProductGridDOM();
    };
  }

  document.getElementById("clear-search-btn")?.addEventListener("click", () => {
    pos.searchQuery = "";
    if (searchInput) searchInput.value = "";
    updateProductGridDOM();
  });

  document.querySelectorAll(".category-chip").forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll(".category-chip").forEach(c => {
        c.classList.remove("bg-primary", "text-on-primary", "shadow-md");
        c.classList.add("bg-surface-container-high", "text-on-surface");
      });
      chip.classList.remove("bg-surface-container-high", "text-on-surface");
      chip.classList.add("bg-primary", "text-on-primary", "shadow-md");
      pos.activeCategory = chip.dataset.category;
      updateProductGridDOM();
    };
  });

  // Product Manager Category Filtering (IN-PLACE, ZERO-FLASH)
  document.querySelectorAll(".pm-cat-chip").forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll(".pm-cat-chip").forEach(c => {
        c.classList.remove("bg-primary", "text-on-primary", "shadow-sm");
        c.classList.add("bg-surface", "text-on-surface", "border", "border-outline-variant/30");
      });
      chip.classList.remove("bg-surface", "text-on-surface", "border", "border-outline-variant/30");
      chip.classList.add("bg-primary", "text-on-primary", "shadow-sm");
      pos.productManagerFilter = chip.dataset.cat;
      updateProductManagerGridDOM();
    };
  });

  // Product Manager Search (IN-PLACE, ZERO-FLASH)
  const pmSearch = document.getElementById("pm-search-input");
  if (pmSearch) {
    pmSearch.oninput = (e) => {
      pos.productManagerSearch = e.target.value;
      updateProductManagerGridDOM();
    };
  }

  bindProductCardEvents();
  bindCartRowEvents();
  bindAllDragAndDropGrids();

  document.getElementById("select-customer-btn")?.addEventListener("click", openCustomerModal);
  document.getElementById("cart-discount-btn")?.addEventListener("click", openDiscountModal);
  document.getElementById("bar-discount-btn")?.addEventListener("click", openDiscountModal);
  document.getElementById("add-note-btn")?.addEventListener("click", openNoteModal);

  document.getElementById("open-clear-modal-btn")?.addEventListener("click", () => {
    if (pos.cart.length > 0) {
      pos.clearCart();
      showToast("Cart cleared", "info", "delete_sweep");
    }
  });
  document.getElementById("bar-clear-btn")?.addEventListener("click", () => {
    if (pos.cart.length > 0) {
      pos.clearCart();
      showToast("Cart cleared", "info", "delete_sweep");
    }
  });

  document.getElementById("proceed-payment-btn")?.addEventListener("click", () => {
    if (pos.cart.length > 0) {
      setRoute("payment-method");
    }
  });

  document.getElementById("pay-back-dashboard-btn")?.addEventListener("click", () => setRoute("dashboard"));
  document.getElementById("select-cash-pay-btn")?.addEventListener("click", () => setRoute("calculation"));
  document.getElementById("select-digital-pay-btn")?.addEventListener("click", openDigitalPaymentModal);
  document.getElementById("select-split-pay-btn")?.addEventListener("click", openSplitPaymentModal);

  document.getElementById("calc-back-btn")?.addEventListener("click", () => setRoute("payment-method"));
  
  // Numpad & Quick Cash (IN-PLACE, ZERO-FLASH)
  document.querySelectorAll(".quick-amt-btn").forEach(btn => {
    btn.onclick = () => {
      pos.calcInput = btn.dataset.val;
      updateCalculationDisplay();
    };
  });

  document.querySelectorAll(".numpad-key-btn").forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.val;
      if (pos.calcInput === "0.00" || pos.calcInput === "0") {
        pos.calcInput = val;
      } else {
        if (val === '.' && pos.calcInput.includes('.')) return;
        if (pos.calcInput.length < 8) pos.calcInput += val;
      }
      updateCalculationDisplay();
    };
  });

  document.getElementById("numpad-backspace-btn")?.addEventListener("click", () => {
    if (pos.calcInput.length > 0) {
      pos.calcInput = pos.calcInput.slice(0, -1);
      if (pos.calcInput === "") pos.calcInput = "0";
      updateCalculationDisplay();
    }
  });

  document.getElementById("calc-clear-input-btn")?.addEventListener("click", () => {
    pos.calcInput = "0";
    updateCalculationDisplay();
  });

  document.getElementById("confirm-cash-payment-btn")?.addEventListener("click", () => {
    const total = pos.getTotalDue();
    const received = parseFloat(pos.calcInput) || 0;
    if (received >= total) {
      const change = received - total;
      pos.completeOrder("Cash", {
        amountReceived: received,
        changeDue: change
      });
      setRoute("confirmation");
      showToast("Cash transaction confirmed!", "success", "payments");
    }
  });

  document.getElementById("confirm-print-receipt-btn")?.addEventListener("click", () => printThermalReceipt());
  
  document.getElementById("confirm-new-order-btn")?.addEventListener("click", () => {
    pos.clearCart();
    setRoute("dashboard");
  });

  document.getElementById("send-email-receipt-btn")?.addEventListener("click", () => {
    const input = document.getElementById("receipt-email-input");
    if (input && input.value.includes("@")) {
      showToast(`Receipt emailed to ${input.value}`, "success", "mark_email_read");
      input.value = "";
    } else {
      showToast("Please enter a valid email", "error", "error");
    }
  });

  document.querySelectorAll(".history-print-btn").forEach(btn => {
    btn.onclick = () => {
      const receiptNo = btn.dataset.receipt;
      const found = pos.orders.find(o => o.receiptNumber === receiptNo);
      if (found) {
        printThermalReceipt(found);
      }
    };
  });

  document.getElementById("export-csv-btn")?.addEventListener("click", () => {
    if (pos.orders.length === 0) {
      showToast("No orders to export", "error", "error");
      return;
    }
    const headers = ["Receipt", "Date", "Customer", "Items Count", "Payment Method", "Subtotal (INR)", "GST", "Discount", "Total (INR)"];
    const rows = pos.orders.map(o => [
      o.receiptNumber,
      `"${o.displayDate}"`,
      `"${o.customer?.name || 'Walk-in'}"`,
      o.items.reduce((s, i) => s + i.qty, 0),
      o.paymentMethod,
      o.subtotal,
      o.tax,
      o.discount,
      o.total
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MGN_Cafe_Sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("Sales CSV exported successfully", "success", "download");
  });

  document.getElementById("save-settings-btn")?.addEventListener("click", () => {
    pos.settings.storeName = document.getElementById("set-store-name")?.value.trim() || "MGN Cafe";
    pos.settings.storeBranch = document.getElementById("set-store-branch")?.value.trim() || "Main Branch · Terminal #01";
    pos.settings.terminal = document.getElementById("set-terminal")?.value.trim() || "Terminal #01";
    pos.settings.cashier = document.getElementById("set-cashier")?.value.trim() || "Cashier";
    pos.settings.receiptPhone = document.getElementById("set-receipt-phone")?.value.trim() || "+91 98765 43210";
    pos.settings.businessEmail = document.getElementById("set-business-email")?.value.trim() || "";
    pos.settings.gstin = document.getElementById("set-gstin")?.value.trim() || "";
    pos.settings.upiId = document.getElementById("set-upi-id")?.value.trim() || "";
    const rawTaxRate = parseFloat(document.getElementById("set-tax-rate")?.value);
    pos.settings.taxRate = (!isNaN(rawTaxRate) && rawTaxRate >= 0) ? rawTaxRate : 0.0;
    pos.settings.currency = document.getElementById("set-currency")?.value.trim() || "₹";
    pos.settings.taxMode = document.getElementById("set-tax-mode")?.value || "exclusive";
    pos.settings.invoicePrefix = document.getElementById("set-invoice-prefix")?.value.trim() || "MGN-";
    pos.settings.autoRoundOff = !!document.getElementById("set-auto-roundoff")?.checked;
    
    const newFloat = parseFloat(document.getElementById("set-starting-float")?.value) || 0.00;
    const oldFloat = pos.settings.drawerFloat || 0.00;
    pos.settings.drawerFloat = newFloat;

    // Sync drawer float and recalculate live balance
    const floatDiff = newFloat - oldFloat;
    pos.drawer.startingFloat = newFloat;
    pos.drawer.currentBalance = Math.max(0, (pos.drawer.currentBalance || 0) + floatDiff);
    pos.saveDrawer();

    pos.settings.paperWidth = document.getElementById("set-paper-width")?.value || "80mm";
    pos.settings.receiptHeader = document.getElementById("set-receipt-header")?.value.trim() || "Welcome to MGN Cafe · Artisan Coffee";
    pos.settings.receiptFooter = document.getElementById("set-receipt-footer")?.value.trim() || "Thank you for visiting MGN Cafe! Have a great day.";
    pos.settings.showLogoOnReceipt = !!document.getElementById("set-show-logo")?.checked;
    pos.settings.showGstinOnReceipt = !!document.getElementById("set-show-gstin")?.checked;
    pos.settings.showCustomerOnReceipt = !!document.getElementById("set-show-customer")?.checked;

    pos.saveSettings();
    if (typeof cloudSync !== "undefined") {
      cloudSync.publish("settings_update", { type: "SETTINGS_UPDATE", settings: pos.settings });
    }
    renderApp();
    showToast(`Settings saved successfully (GST: ${pos.settings.taxRate}%)`, "success", "check");
  });

  document.getElementById("test-print-receipt-btn")?.addEventListener("click", () => {
    const sampleOrder = pos.orders.length > 0 ? pos.orders[0] : {
      receiptNumber: `${pos.settings.invoicePrefix || 'MGN-'}SAMPLE`,
      displayDate: new Date().toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
      customer: { name: "Sample Customer", phone: "+91 98765 00000" },
      items: [
        { name: "Double Smash Burger", qty: 1, price: 249.00, modifier: "Extra Cheese" },
        { name: "Iced Vanilla Latte", qty: 2, price: 180.00, modifier: "Oat Milk" }
      ],
      subtotal: 609.00,
      tax: parseFloat(((pos.settings.taxRate || 0) > 0 ? (609.00 * ((pos.settings.taxRate || 0) / 100)) : 0).toFixed(2)),
      taxRate: pos.settings.taxRate !== undefined ? pos.settings.taxRate : 0.0,
      discount: 0,
      total: parseFloat((609.00 + ((pos.settings.taxRate || 0) > 0 ? (609.00 * ((pos.settings.taxRate || 0) / 100)) : 0)).toFixed(2)),
      paymentMethod: "UPI / Digital",
      terminal: pos.settings.terminal,
      cashier: pos.settings.cashier
    };
    printThermalReceipt(sampleOrder);
  });

  document.getElementById("clear-orders-btn")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all completed sales history? Current menu catalog will remain safe.")) {
      pos.orders = [];
      pos.saveOrders();
      renderApp();
      showToast("All sales history cleared", "info", "delete_sweep");
    }
  });

  document.getElementById("clear-investments-btn")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all expense and investment logs?")) {
      pos.investments = [];
      pos.saveInvestments();
      renderApp();
      showToast("All expense logs cleared", "info", "delete_sweep");
    }
  });

  document.getElementById("backup-data-btn")?.addEventListener("click", () => {
    const backup = {
      settings: pos.settings,
      products: pos.products,
      categories: pos.categories,
      orders: pos.orders,
      investments: pos.investments,
      drawer: pos.drawer,
      heldOrders: pos.heldOrders,
      version: "4.5",
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MGN_POS_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showToast("Complete POS backup exported", "success", "file_download");
  });

  document.getElementById("trigger-restore-btn")?.addEventListener("click", () => {
    document.getElementById("restore-backup-file-input")?.click();
  });

  document.getElementById("restore-backup-file-input")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.products && data.settings) {
          if (confirm("Restore POS database from this backup file? Existing data will be overwritten.")) {
            if (data.settings) localStorage.setItem("mgn_pos_settings", JSON.stringify(data.settings));
            if (data.products) localStorage.setItem("mgn_pos_products", JSON.stringify(data.products));
            if (data.categories) localStorage.setItem("mgn_pos_categories", JSON.stringify(data.categories));
            if (data.orders) localStorage.setItem("mgn_pos_orders", JSON.stringify(data.orders));
            if (data.investments) localStorage.setItem("mgn_pos_investments", JSON.stringify(data.investments));
            if (data.drawer) localStorage.setItem("mgn_pos_drawer", JSON.stringify(data.drawer));
            if (data.heldOrders) localStorage.setItem("mgn_pos_held_orders", JSON.stringify(data.heldOrders));
            
            pos.loadState();
            renderApp();
            showToast("Database restored successfully from backup", "success", "cloud_done");
          }
        } else {
          showToast("Invalid POS backup JSON structure", "error", "error");
        }
      } catch (err) {
        showToast("Error parsing backup file", "error", "error");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("reset-data-btn")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to perform a complete Factory Reset? All menu products, sales history, expenses, and cash drawer records will be completely deleted into a clean fresh state (0 dummy data).")) {
      localStorage.clear();
      
      localStorage.setItem("mgn_pos_products", JSON.stringify([]));
      localStorage.setItem("mgn_pos_categories", JSON.stringify(["All Items"]));
      localStorage.setItem("mgn_pos_orders", JSON.stringify([]));
      localStorage.setItem("mgn_pos_investments", JSON.stringify([]));
      localStorage.setItem("mgn_pos_held_orders", JSON.stringify([]));
      localStorage.setItem("mgn_pos_drawer", JSON.stringify({
        startingFloat: 0.00,
        cashSales: 0.00,
        cashIn: 0.00,
        cashOut: 0.00,
        currentBalance: 0.00,
        logs: []
      }));
      localStorage.setItem("mgn_pos_settings", JSON.stringify(DEFAULT_SETTINGS));

      pos.products = [];
      pos.categories = ["All Items"];
      pos.orders = [];
      pos.investments = [];
      pos.heldOrders = [];
      pos.cart = [];
      pos.customer = { name: "Walk-in Customer", phone: "", id: "CUST-01" };
      pos.discount = { type: "none", value: 0 };
      pos.orderNote = "";
      pos.settings = { ...DEFAULT_SETTINGS };
      pos.drawer = {
        startingFloat: 0.00,
        cashSales: 0.00,
        cashIn: 0.00,
        cashOut: 0.00,
        currentBalance: 0.00,
        logs: []
      };

      renderApp();
      showToast("Factory Reset complete — all data wiped clean", "info", "restart_alt");
    }
  });
}

document.addEventListener("click", (e) => {
  if (e.target.id === "general-modal" || e.target.id === "clear-all-modal") {
    closeModal();
  }
});

function updateHeaderClock() {
  const clockEl = document.getElementById("header-live-time");
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Auto-detect ?importMenu= in URL (for 1-click QR / Link sharing)
  try {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const importParam = urlParams.get("importMenu");
      if (importParam) {
        const decoded = decodeURIComponent(atob(importParam));
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed.products) && parsed.products.length > 0) {
          pos.products = parsed.products;
          pos.saveProducts();
          if (Array.isArray(parsed.categories)) {
            parsed.categories.forEach(c => {
              if (!pos.categories.includes(c)) pos.categories.push(c);
            });
            pos.saveCategories();
          }
          if (parsed.settings) {
            pos.settings = { ...pos.settings, ...parsed.settings };
            pos.saveSettings();
          }
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          showToast(`✅ Successfully imported ${pos.products.length} menu items from QR code!`, "success", "check_circle", 5000);
        }
      }
    }
  } catch (e) {
    console.warn("importMenu query parse error:", e);
  }

  renderApp();
  updateHeaderClock();
  setInterval(updateHeaderClock, 1000);
  updateKitchenBadgeDOM();

  // Initialize Real-Time Multi-Device Cloud Sync
  if (typeof cloudSync !== "undefined") {
    cloudSync.init();
  }

  // KDS Live Elapsed Timer Ticker (updates without screen flicker)
  setInterval(() => {
    document.querySelectorAll(".kds-elapsed-timer").forEach(timerEl => {
      const startTime = parseInt(timerEl.dataset.timestamp);
      if (startTime) {
        const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
        const elapsedSeconds = Math.floor(((Date.now() - startTime) % 60000) / 1000);
        timerEl.textContent = `${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;
      }
    });
  }, 1000);

  // Cross-Tab Real-time KDS Broadcast Sync
  try {
    if (typeof window !== "undefined" && window.BroadcastChannel) {
      const kdsChannel = new BroadcastChannel("mgn_pos_kds_channel");
      kdsChannel.onmessage = (event) => {
        if (event.data && (event.data.type === "NEW_ORDER" || event.data.type === "STATUS_CHANGE")) {
          const storedOrders = JSON.parse(localStorage.getItem("mgn_pos_orders"));
          if (storedOrders) {
            pos.orders = storedOrders;
          }
          updateKitchenBadgeDOM();
          if (event.data.type === "NEW_ORDER") {
            playKitchenAudioChime();
          }
          if (pos.currentRoute === "kitchen") {
            updateKitchenScreenDOM();
          }
        }
      };
    }
  } catch (e) {}

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === "mgn_pos_orders" || e.key === "mgn_kds_last_event") {
        const storedOrders = JSON.parse(localStorage.getItem("mgn_pos_orders"));
        if (storedOrders) {
          pos.orders = storedOrders;
        }
        updateKitchenBadgeDOM();
        if (pos.currentRoute === "kitchen") {
          updateKitchenScreenDOM();
        }
      }
    });
  }
});

// ==========================================
// 12. PWA SERVICE WORKER REGISTRATION (OFFLINE READY)
// ==========================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('MGN POS PWA Service Worker Registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service Worker registration skipped:', err);
      });
  });
}
