-- Add missing performance indexes for high-frequency lookups
-- This migration adds indexes to improve query performance on frequently accessed columns

-- 1. Profiles table - WhatsApp phone lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_wa_phone 
ON public.profiles(wa_phone) 
WHERE wa_phone IS NOT NULL;

-- 2. Rides table - User trip history lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rides_passenger_user_id 
ON public.rides(passenger_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rides_driver_user_id 
ON public.rides(driver_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rides_status_created 
ON public.rides(status, created_at DESC);

-- 3. QR Generations table - User QR history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_generations_user_id 
ON public.qr_generations(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_generations_created_at 
ON public.qr_generations(created_at DESC);

-- 4. Vehicle OCR Jobs table - Status and user lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicle_ocr_jobs_status 
ON public.vehicle_ocr_jobs(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicle_ocr_jobs_user_id_status 
ON public.vehicle_ocr_jobs(user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicle_ocr_jobs_created_at 
ON public.vehicle_ocr_jobs(created_at DESC);

-- 5. WhatsApp Logs table - Message tracking and debugging
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_logs_direction 
ON public.whatsapp_logs(direction);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_logs_status 
ON public.whatsapp_logs(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_logs_created_at 
ON public.whatsapp_logs(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_logs_from_phone 
ON public.whatsapp_logs(from_phone);

-- 6. Insurance Quotes table - User quote history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_insurance_quotes_user_id 
ON public.insurance_quotes(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_insurance_quotes_status 
ON public.insurance_quotes(status);

-- 7. Chat Sessions table - User session lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_user_id 
ON public.chat_sessions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_state 
ON public.chat_sessions(state);

-- 8. Driver Availability table - Active driver lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_availability_is_active 
ON public.driver_availability(is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_availability_last_seen 
ON public.driver_availability(last_seen_at DESC);

-- 9. Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_active_location_time 
ON public.drivers(is_active, last_seen_at DESC) 
WHERE location IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rides_user_status_time 
ON public.rides(passenger_user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_logs_user_direction_time 
ON public.whatsapp_logs(from_phone, direction, created_at DESC);

-- 10. Partial indexes for active/valid records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_active_user 
ON public.vehicles(user_id) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_insurance_quotes_active_user 
ON public.insurance_quotes(user_id) 
WHERE status IN ('active', 'pending');

-- 11. Text search indexes for better search performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_name_search 
ON public.profiles USING gin(to_tsvector('english', COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_plate_search 
ON public.vehicles USING gin(to_tsvector('english', plate));

-- 12. Time-based partitioning hints (for future optimization)
-- Note: These are commented out as they require table restructuring
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_logs_date_partition 
-- ON public.whatsapp_logs(date_trunc('day', created_at));

-- 13. Function-based indexes for common calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rides_distance_calc 
ON public.rides((ST_Distance(
  pickup_location::geometry, 
  dropoff_location::geometry
) / 1000)) -- Distance in kilometers
WHERE pickup_location IS NOT NULL AND dropoff_location IS NOT NULL;

-- 14. Covering indexes for frequently accessed data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_essential 
ON public.profiles(id, first_name, last_name, wa_phone, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rides_summary 
ON public.rides(id, passenger_user_id, driver_user_id, status, created_at, pickup_location, dropoff_location);

-- 15. Statistics update to ensure query planner has current information
ANALYZE public.profiles;
ANALYZE public.rides;
ANALYZE public.vehicles;
ANALYZE public.qr_generations;
ANALYZE public.vehicle_ocr_jobs;
ANALYZE public.whatsapp_logs;
ANALYZE public.insurance_quotes;
ANALYZE public.chat_sessions;
ANALYZE public.driver_availability;
ANALYZE public.drivers;
