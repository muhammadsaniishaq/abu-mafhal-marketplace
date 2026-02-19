-- CHECK VENDOR LOGOS
SELECT id, business_name, store_name, logo_url, is_verified 
FROM vendors 
WHERE is_verified = true;
