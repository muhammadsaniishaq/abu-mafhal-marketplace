-- Function to decrement stock
CREATE OR REPLACE FUNCTION decrement_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after a new order item is created
DROP TRIGGER IF EXISTS decrement_stock_on_order ON order_items;

CREATE TRIGGER decrement_stock_on_order
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION decrement_stock();
