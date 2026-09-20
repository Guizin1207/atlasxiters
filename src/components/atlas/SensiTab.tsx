import { useMemo, useState } from "react";
import { Check, Copy, Gauge, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { SensiResult } from "@/lib/atlas-sensi";

