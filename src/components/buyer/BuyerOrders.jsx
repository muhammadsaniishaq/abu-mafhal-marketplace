import { supabase } from '../../config/supabase';

const BuyerOrders = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchOrders();

    // Set up real-time subscription for orders
    const channel = supabase
      .channel('public:orders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `buyer_id=eq.${currentUser?.uid || currentUser?.id}`
      }, (payload) => {
        console.log('Real-time order change:', payload);
        fetchOrders(); // Refresh data on change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .eq('buyer_id', currentUser?.uid || currentUser?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders from Supabase:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      processing: 'bg-purple-100 text-purple-800 border-purple-300',
      shipped: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏳',
      confirmed: '✅',
      processing: '📦',
      shipped: '🚚',
      delivered: '🎉',
      completed: '✔️',
      cancelled: '❌'
    };
    return icons[status] || '📋';
  };

  const filteredOrders = orders
    .filter(order => {
      if (filterStatus !== 'all' && order.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          order.id.toLowerCase().includes(query) ||
          order.items?.some(item => item.productName.toLowerCase().includes(query))
        );
      }
      return true;
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">My Orders</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search orders by ID or product name..."
          className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="all">All Orders</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg">
          <p className="text-6xl mb-4">📦</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {searchQuery || filterStatus !== 'all' ? 'No orders found' : 'No orders yet'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your filters'
              : 'Start shopping to see your orders here'}
          </p>
          <Link
            to="/shop"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div key={order.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              {/* Order Header */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 border-b dark:border-gray-700">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Order ID</p>
                    <p className="font-mono font-bold text-gray-900 dark:text-white">
                      #{order.id.substring(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Order Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">
                      ₦{order.total?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className={`px-4 py-2 rounded-full text-sm font-medium border inline-flex items-center gap-2 ${getStatusColor(order.status)}`}>
                      <span>{getStatusIcon(order.status)}</span>
                      <span>{order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="p-4">
                <div className="space-y-3 mb-4">
                  {order.items?.map((item, index) => (
                    <div key={index} className="flex gap-4">
                      <img
                        src={item.image || 'https://via.placeholder.com/100'}
                        alt={item.productName}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {item.productName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Quantity: {item.quantity}
                        </p>
                        {item.selectedVariation && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {Object.entries(item.selectedVariation).map(([key, value]) =>
                              `${key}: ${value}`
                            ).join(', ')}
                          </p>
                        )}
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          ₦{(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tracking Number */}
                {order.trackingNumber && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-400 mb-1">
                      Tracking Number
                    </p>
                    <p className="font-mono font-bold text-blue-900 dark:text-blue-300">
                      {order.trackingNumber}
                    </p>
                    {order.carrier && (
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        Carrier: {order.carrier}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/buyer/orders/track/${order.id}`}
                    className="flex-1 min-w-[150px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-lg font-medium transition-colors"
                  >
                    Track Order
                  </Link>

                  {order.status === 'delivered' && (
                    <>
                      <Link
                        to={`/buyer/reviews?orderId=${order.id}`}
                        className="flex-1 min-w-[150px] px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-center rounded-lg font-medium transition-colors"
                      >
                        Write Review
                      </Link>
                      <button
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                      >
                        Report Issue
                      </button>
                    </>
                  )}

                  {order.status === 'pending' && (
                    <button
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to cancel this order?')) {
                          // Add cancel order logic here
                          alert('Cancel order feature coming soon');
                        }
                      }}
                    >
                      Cancel Order
                    </button>
                  )}

                  <Link
                    to={`/messages?orderId=${order.id}`}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                  >
                    Contact Vendor
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {orders.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{orders.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {orders.filter(o => o.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">
              {orders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600">
              {orders.filter(o => o.status === 'delivered' || o.status === 'completed').length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerOrders;