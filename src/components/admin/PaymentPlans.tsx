import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PaymentPlan {
  id: string;
  label: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export function PaymentPlans() {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_plans")
        .select("*")
        .order("id");
      
      if (error) throw error;
      
      const formattedPlans: PaymentPlan[] = (data || []).map(plan => ({
        id: plan.id.toString(),
        label: plan.name,
        description: plan.description,
        is_active: true,
        created_at: new Date().toISOString()
      }));
      
      setPlans(formattedPlans);
    } catch (error) {
      console.error('Error loading payment plans:', error);
      toast.error('Failed to load payment plans');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Payment Plans</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPlan(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? 'Edit Payment Plan' : 'Add Payment Plan'}
              </DialogTitle>
            </DialogHeader>
            <PaymentPlanForm
              plan={editingPlan}
              onSave={(data) => {
                toast.success(editingPlan ? 'Plan updated' : 'Plan created');
                setIsDialogOpen(false);
                setEditingPlan(null);
                loadPlans();
              }}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingPlan(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading payment plans...</div>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{plan.label}</CardTitle>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={plan.is_active} />
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {plan.is_active ? 'Active' : 'Inactive'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentPlanForm({ plan, onSave, onCancel }: {
  plan: PaymentPlan | null;
  onSave: (data: Omit<PaymentPlan, 'id' | 'created_at'>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(plan?.label || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('Please enter a label');
      return;
    }

    onSave({
      label: label.trim(),
      description: description.trim() || undefined,
      is_active: isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Full Payment"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="active"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
        <Label htmlFor="active">Active</Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {plan ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}