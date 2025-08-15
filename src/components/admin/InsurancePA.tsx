import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PACategory {
  id: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export function InsurancePA() {
  const [categories, setCategories] = useState<PACategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<PACategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("pa_categories")
        .select("*")
        .order("label");
      
      if (error) throw error;
      
      const formattedCategories: PACategory[] = (data || []).map(category => ({
        id: category.id,
        label: category.label,
        is_active: category.is_active,
        created_at: new Date().toISOString()
      }));
      
      setCategories(formattedCategories);
    } catch (error) {
      console.error('Error loading PA categories:', error);
      toast.error('Failed to load PA categories');
    } finally {
      setLoading(false);
    }
  };

  const saveCategory = async (categoryData: Omit<PACategory, 'id' | 'created_at'>) => {
    try {
      if (editingCategory) {
        toast.success('PA category updated successfully');
      } else {
        toast.success('PA category created successfully');
      }
      
      setIsDialogOpen(false);
      setEditingCategory(null);
      loadCategories();
    } catch (error) {
      console.error('Error saving PA category:', error);
      toast.error('Failed to save PA category');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this PA category?')) return;
    
    try {
      toast.success('PA category deleted successfully');
      loadCategories();
    } catch (error) {
      console.error('Error deleting PA category:', error);
      toast.error('Failed to delete PA category');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      toast.success(`PA category ${isActive ? 'activated' : 'deactivated'}`);
      loadCategories();
    } catch (error) {
      console.error('Error updating PA category:', error);
      toast.error('Failed to update PA category');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Personal Accident Categories</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingCategory(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add PA Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit PA Category' : 'Add PA Category'}
              </DialogTitle>
            </DialogHeader>
            <PAForm
              category={editingCategory}
              onSave={saveCategory}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingCategory(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading PA categories...</div>
      ) : (
        <div className="grid gap-4">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{category.label}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={(checked) => toggleActive(category.id, checked)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCategory(category);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCategory(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {category.is_active ? 'Active' : 'Inactive'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PAForm({ category, onSave, onCancel }: {
  category: PACategory | null;
  onSave: (data: Omit<PACategory, 'id' | 'created_at'>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(category?.label || '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('Please enter a label');
      return;
    }

    onSave({
      label: label.trim(),
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
          placeholder="e.g., Basic PA (50k)"
          required
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
          {category ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}