CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  icon TEXT,
  category TEXT,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE,
  app_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  customer_email TEXT NOT NULL,
  download_token TEXT NOT NULL UNIQUE,
  paystack_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_apps_active ON public.apps (active);
CREATE INDEX IF NOT EXISTS idx_apps_category ON public.apps (category);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_download_token ON public.orders (download_token);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_app_id ON public.orders (app_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders (customer_email);

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public apps are readable" ON public.apps
FOR SELECT
USING (active = true);

CREATE POLICY "Service role can manage apps" ON public.apps
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Orders are not public readable" ON public.orders
FOR SELECT
USING (false);

CREATE POLICY "Service role can create orders" ON public.orders
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update orders" ON public.orders
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete orders" ON public.orders
FOR DELETE
USING (auth.role() = 'service_role');

INSERT INTO public.apps (id, name, description, price, currency, icon, category, filename, storage_path, active)
VALUES
  ('app1', 'Productivity Pro', 'Boost your productivity with this powerful tool', 500, 'KES', '🚀', 'Productivity', 'productivity-pro.apk', 'apps/productivity-pro.apk', true),
  ('app2', 'Finance Tracker', 'Track your expenses and savings easily', 350, 'KES', '💰', 'Finance', 'finance-tracker.apk', 'apps/finance-tracker.apk', true),
  ('app3', 'Health Monitor', 'Monitor your health metrics daily', 750, 'KES', '❤️', 'Health', 'health-monitor.apk', 'apps/health-monitor.apk', true)
ON CONFLICT (id) DO NOTHING;
