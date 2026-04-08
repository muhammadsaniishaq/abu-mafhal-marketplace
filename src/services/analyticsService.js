import { supabase } from '../config/supabase';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export const getVendorAnalytics = async (vendorId, months = 6) => {
  try {
    const startDate = subMonths(new Date(), months).toISOString();
    
    // Fetch orders (Note: In Supabase, we might need to join or a view if vendor_orders is not a table)
    // Assuming 'orders' table has vendor specific items or there's a joinable structure.
    // Parity with previous logic: Querying orders that involve this vendor.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items!inner(vendor_id)')
      .eq('order_items.vendor_id', vendorId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId);

    if (productsError) throw productsError;

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Revenue by month
    const revenueByMonth = {};
    orders.forEach(order => {
      const month = format(new Date(order.created_at), 'MMM yyyy');
      revenueByMonth[month] = (revenueByMonth[month] || 0) + order.total;
    });

    // Top selling products
    const productSales = {};
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = {
            id: item.product_id,
            name: item.product_name,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.product_id].quantity += item.quantity;
        productSales[item.product_id].revenue += item.price * item.quantity;
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
    const uniqueCustomers = new Set(orders.map(o => o.user_id)).size;

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
    console.error('Error getting vendor analytics:', error.message);
    throw error;
  }
};

export const getAdminAnalytics = async (months = 6) => {
  try {
    const startDate = subMonths(new Date(), months).toISOString();

    // Fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    // Fetch users (profiles)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*');

    if (usersError) throw usersError;

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*');

    if (productsError) throw productsError;

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const platformCommission = totalRevenue * 0.10;
    const vendorEarnings = totalRevenue - platformCommission;

    // Revenue trends
    const revenueByMonth = {};
    orders.forEach(order => {
      const month = format(new Date(order.created_at), 'MMM yyyy');
      revenueByMonth[month] = (revenueByMonth[month] || 0) + order.total;
    });

    // User growth
    const usersByMonth = {};
    users.forEach(user => {
      if (user.created_at) {
        const month = format(new Date(user.created_at), 'MMM yyyy');
        usersByMonth[month] = (usersByMonth[month] || 0) + 1;
      }
    });

    // Category distribution
    const categoryRevenue = {};
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        if (product?.category) {
          categoryRevenue[product.category] = (categoryRevenue[product.category] || 0) + (item.price * item.quantity);
        }
      });
    });

    // Top vendors
    const vendorRevenue = {};
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        vendorRevenue[item.vendor_id] = (vendorRevenue[item.vendor_id] || 0) + (item.price * item.quantity);
      });
    });

    const topVendors = Object.entries(vendorRevenue)
      .map(([vendorId, revenue]) => {
        const vendor = users.find(u => u.id === vendorId);
        return {
          id: vendorId,
          name: vendor?.full_name || 'Unknown',
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
    console.error('Error getting admin analytics:', error.message);
    throw error;
  }
};