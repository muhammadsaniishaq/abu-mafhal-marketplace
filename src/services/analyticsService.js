import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export const getVendorAnalytics = async (vendorId, months = 6) => {
  try {
    const startDate = subMonths(new Date(), months);
    
    // Fetch orders
    const ordersQuery = query(
      collection(db, 'vendorOrders'),
      where('vendorId', '==', vendorId),
      where('createdAt', '>=', startDate.toISOString())
    );
    const ordersSnapshot = await getDocs(ordersQuery);
    const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch products
    const productsQuery = query(
      collection(db, 'products'),
      where('vendorId', '==', vendorId)
    );
    const productsSnapshot = await getDocs(productsQuery);
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Revenue by month
    const revenueByMonth = {};
    orders.forEach(order => {
      const month = format(new Date(order.createdAt), 'MMM yyyy');
      revenueByMonth[month] = (revenueByMonth[month] || 0) + order.total;
    });

    // Top selling products
    const productSales = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            id: item.productId,
            name: item.productName,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.price * item.quantity;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Order status distribution
    const statusDistribution = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    // Low stock products
    const lowStockProducts = products
      .filter(p => p.stock < 10)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    // Customer insights
    const uniqueCustomers = new Set(orders.map(o => o.userId)).size;

    return {
      overview: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        uniqueCustomers,
        totalProducts: products.length,
        activeProducts: products.filter(p => p.status === 'approved').length
      },
      revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({
        month,
        revenue
      })),
      topProducts,
      statusDistribution: Object.entries(statusDistribution).map(([status, count]) => ({
        status,
        count
      })),
      lowStockProducts,
      recentOrders: orders.slice(0, 10)
    };
  } catch (error) {
    console.error('Error getting vendor analytics:', error);
    throw error;
  }
};

export const getAdminAnalytics = async (months = 6) => {
  try {
    const startDate = subMonths(new Date(), months);

    // Fetch all orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startDate.toISOString())
    );
    const ordersSnapshot = await getDocs(ordersQuery);
    const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const platformCommission = totalRevenue * 0.10;
    const vendorEarnings = totalRevenue - platformCommission;

    // Revenue trends
    const revenueByMonth = {};
    orders.forEach(order => {
      const month = format(new Date(order.createdAt), 'MMM yyyy');
      revenueByMonth[month] = (revenueByMonth[month] || 0) + order.total;
    });

    // User growth
    const usersByMonth = {};
    users.forEach(user => {
      if (user.createdAt) {
        const month = format(new Date(user.createdAt), 'MMM yyyy');
        usersByMonth[month] = (usersByMonth[month] || 0) + 1;
      }
    });

    // Category distribution
    const categoryRevenue = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product?.category) {
          categoryRevenue[product.category] = (categoryRevenue[product.category] || 0) + (item.price * item.quantity);
        }
      });
    });

    // Top vendors
    const vendorRevenue = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        vendorRevenue[item.vendorId] = (vendorRevenue[item.vendorId] || 0) + (item.price * item.quantity);
      });
    });

    const topVendors = Object.entries(vendorRevenue)
      .map(([vendorId, revenue]) => {
        const vendor = users.find(u => u.id === vendorId);
        return {
          id: vendorId,
          name: vendor?.name || 'Unknown',
          revenue
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      overview: {
        totalRevenue,
        platformCommission,
        vendorEarnings,
        totalOrders: orders.length,
        totalUsers: users.length,
        totalVendors: users.filter(u => u.role === 'vendor').length,
        totalProducts: products.length,
        activeProducts: products.filter(p => p.status === 'approved').length
      },
      revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({
        month,
        revenue
      })),
      userGrowth: Object.entries(usersByMonth).map(([month, count]) => ({
        month,
        users: count
      })),
      categoryRevenue: Object.entries(categoryRevenue).map(([category, revenue]) => ({
        category,
        revenue
      })),
      topVendors
    };
  } catch (error) {
    console.error('Error getting admin analytics:', error);
    throw error;
  }
};