import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Standard UI
import { Trash, Plus, Image as ImageIcon, ArrowUp, ArrowDown, Save } from "lucide-react";
import { toast } from "react-hot-toast";

// Helper for file upload
async function uploadImage(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `hero/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('products') // Using 'products' bucket for now, or create 'content' bucket
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('products').getPublicUrl(filePath);
    return data.publicUrl;
}

export default function HeroManager() {
    const [slides, setSlides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // New Slide Form State
    const [newSlide, setNewSlide] = useState({
        title: "",
        subtitle: "",
        cta_link: "/shop",
        image_file: null
    });

    useEffect(() => {
        fetchSlides();
    }, []);

    const fetchSlides = async () => {
        try {
            const { data, error } = await supabase
                .from('hero_slides')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;
            setSlides(data || []);
        } catch (error) {
            // Silent fail if table doesn't exist yet (user needs to run SQL)
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newSlide.image_file) return toast.error("Please select an image");

        setIsUploading(true);
        try {
            const imageUrl = await uploadImage(newSlide.image_file);

            const { data, error } = await supabase
                .from('hero_slides')
                .insert([{
                    title: newSlide.title,
                    subtitle: newSlide.subtitle,
                    cta_link: newSlide.cta_link,
                    image_url: imageUrl,
                    sort_order: slides.length // append to end
                }])
                .select()
                .single();

            if (error) throw error;

            setSlides([...slides, data]);
            setNewSlide({ title: "", subtitle: "", cta_link: "/shop", image_file: null });
            toast.success("Slide added");

            // Reset file input manually if needed
            document.getElementById('file-upload').value = "";

        } catch (error) {
            console.error(error);
            toast.error("Failed to create slide");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this slide?")) return;
        try {
            await supabase.from('hero_slides').delete().eq('id', id);
            setSlides(slides.filter(s => s.id !== id));
            toast.success("Slide deleted");
        } catch (e) { toast.error("Delete failed"); }
    };

    const toggleActive = async (slide) => {
        try {
            await supabase.from('hero_slides').update({ is_active: !slide.is_active }).eq('id', slide.id);
            setSlides(slides.map(s => s.id === slide.id ? { ...s, is_active: !s.is_active } : s));
        } catch (e) { toast.error("Update failed"); }
    };

    return (
        <AdminShell>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Hero Carousel</h2>
                    <p className="text-gray-500">Manage the main home page banners.</p>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Create Form */}
                <Card className="h-fit">
                    <CardContent className="p-6 space-y-4">
                        <h3 className="font-semibold flex items-center gap-2"><Plus size={18} /> Add New Slide</h3>

                        <div className="space-y-2">
                            <Label>Banner Image</Label>
                            <Input
                                id="file-upload"
                                type="file"
                                accept="image/*"
                                onChange={e => setNewSlide({ ...newSlide, image_file: e.target.files[0] })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Title (Optional)</Label>
                            <Input
                                placeholder="e.g. Big Summer Sale"
                                value={newSlide.title}
                                onChange={e => setNewSlide({ ...newSlide, title: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Subtitle (Optional)</Label>
                            <Input
                                placeholder="e.g. Up to 50% off"
                                value={newSlide.subtitle}
                                onChange={e => setNewSlide({ ...newSlide, subtitle: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Link Path</Label>
                            <Input
                                placeholder="/shop"
                                value={newSlide.cta_link}
                                onChange={e => setNewSlide({ ...newSlide, cta_link: e.target.value })}
                            />
                        </div>

                        <Button className="w-full" onClick={handleCreate} disabled={isUploading}>
                            {isUploading ? "Uploading..." : "Add Slide"}
                        </Button>
                    </CardContent>
                </Card>

                {/* List */}
                <div className="lg:col-span-2 space-y-4">
                    {loading && <p>Loading slides...</p>}
                    {!loading && slides.length === 0 && <p className="text-gray-500">No slides yet.</p>}

                    {slides.map((slide, index) => (
                        <Card key={slide.id} className={`overflow-hidden transition-opacity ${!slide.is_active ? 'opacity-60 grayscale' : ''}`}>
                            <div className="relative h-48 w-full bg-gray-100">
                                <img src={slide.image_url} alt={slide.title} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-4 text-center">
                                    <h4 className="text-xl font-bold">{slide.title}</h4>
                                    <p>{slide.subtitle}</p>
                                </div>
                            </div>
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant={slide.is_active ? "ghost" : "outline"} onClick={() => toggleActive(slide)}>
                                        {slide.is_active ? "Active" : "Hidden"}
                                    </Button>
                                    <span className="text-xs text-gray-400">Sort: {slide.sort_order}</span>
                                </div>
                                <Button size="icon" variant="destructive" onClick={() => handleDelete(slide.id)}>
                                    <Trash size={16} />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </AdminShell>
    );
}
