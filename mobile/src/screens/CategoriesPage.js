import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View, Text, TextInput, ScrollView,
    Image, Dimensions, StatusBar,
    RefreshControl, StyleSheet, Animated, Linking, Platform,
    Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";

const { width } = Dimensions.get("window");
const RAIL = 82;

const C = {
    navy:"#0A192F", navyMid:"#0E2340", navyLight:"#1B3358",
    gold:"#D9A73A", goldBright:"#F5C842", goldLight:"#FFF8E1",
    goldBorder:"rgba(217,167,58,0.35)", goldGlow:"rgba(217,167,58,0.18)",
    goldDark:"#A07820", white:"#FFFFFF", offWhite:"#F9F5EB",
    bg:"#F0EDD6", card:"#FFFFFF", border:"#E8D99A", borderSoft:"#EEE5C0",
    slate:"#6B7280", slateLight:"#9CA3AF", slateDark:"#1F2937",
    emerald:"#10B981", emeraldBg:"#ECFDF5", red:"#EF4444", shimmer:"#EDE8D0",
};

const CAT_IMGS = {
    "phones & tablets":"https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=300&auto=format&fit=crop",
    "fashion & apparel":"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=300&auto=format&fit=crop",
    "electronics & gadgets":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=300&auto=format&fit=crop",
    "shoes & footwear":"https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=300&auto=format&fit=crop",
    "beauty & health":"https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=300&auto=format&fit=crop",
    "home & living":"https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=300&auto=format&fit=crop",
    "automotive":"https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=300&auto=format&fit=crop",
    "groceries & food":"https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=300&auto=format&fit=crop",
};

const BANNERS = {
    "phones & tablets":{banner:"https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=700&auto=format&fit=crop",tagline:"Up to 35% OFF Smartphones & Tablets",highlight:"Genuine Brand Warranty"},
    "electronics & gadgets":{banner:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=700&auto=format&fit=crop",tagline:"Premium Laptops, TVs & Smart Audio",highlight:"100% Authentic Tech"},
    "fashion & apparel":{banner:"https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=700&auto=format&fit=crop",tagline:"New Season Men & Women Collections",highlight:"Trending Urban & Traditional"},
    "shoes & footwear":{banner:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=700&auto=format&fit=crop",tagline:"Top Brand Sneakers, Sandals & Loafers",highlight:"Comfort & Durability"},
    "beauty & health":{banner:"https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=700&auto=format&fit=crop",tagline:"Luxury Perfumes & Radiant Skincare",highlight:"Original Brands Only"},
    "home & living":{banner:"https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=700&auto=format&fit=crop",tagline:"Modern Living & Kitchen Essentials",highlight:"Fast Express Delivery"},
};

const SUBCATS = {
    "phones & tablets":[{n:"All",i:"apps",q:""},{n:"Smartphones",i:"phone-portrait",q:"smartphone"},{n:"iPhones",i:"logo-apple",q:"iphone"},{n:"Tablets",i:"tablet-portrait",q:"tablet"},{n:"Earbuds",i:"headset",q:"audio"},{n:"Cases",i:"shield",q:"case"}],
    "electronics & gadgets":[{n:"All",i:"apps",q:""},{n:"Laptops",i:"laptop",q:"laptop"},{n:"Smart TVs",i:"tv",q:"tv"},{n:"Smartwatch",i:"watch",q:"watch"},{n:"Cameras",i:"camera",q:"camera"},{n:"Gaming",i:"game-controller",q:"gaming"}],
    "fashion & apparel":[{n:"All",i:"apps",q:""},{n:"Men",i:"man",q:"men"},{n:"Women",i:"woman",q:"women"},{n:"Traditional",i:"shirt",q:"kaftan"},{n:"Bags",i:"bag",q:"bag"},{n:"Jewelry",i:"diamond",q:"jewelry"}],
    "shoes & footwear":[{n:"All",i:"apps",q:""},{n:"Sneakers",i:"footsteps",q:"sneaker"},{n:"Formal",i:"briefcase",q:"formal"},{n:"Sandals",i:"sunny",q:"sandal"},{n:"Boots",i:"rainy",q:"boot"}],
    "beauty & health":[{n:"All",i:"apps",q:""},{n:"Skincare",i:"sparkles",q:"skincare"},{n:"Perfumes",i:"flower",q:"perfume"},{n:"Hair",i:"cut",q:"hair"},{n:"Makeup",i:"color-palette",q:"makeup"}],
    "home & living":[{n:"All",i:"apps",q:""},{n:"Kitchen",i:"restaurant",q:"kitchen"},{n:"Furniture",i:"bed",q:"furniture"},{n:"Bedding",i:"moon",q:"bedding"},{n:"Appliances",i:"power",q:"appliance"}],
};

const EMOJI = {"phones & tablets":"📱","electronics & gadgets":"💻","fashion & apparel":"👗","shoes & footwear":"👟","beauty & health":"💄","home & living":"🏠","automotive":"🚗","groceries & food":"🛒","sports & fitness":"🏋️","baby & kids":"👶"};

const getCatImg = (cat) => {
    if (cat?.image_url) return cat.image_url;
    const k = (cat?.name||"").toLowerCase().trim();
    for (const [key,img] of Object.entries(CAT_IMGS)) { if (k.includes(key)||key.includes(k)) return img; }
    return "https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=300&auto=format&fit=crop";
};

const getBanner = (cat) => {
    const k = (cat?.name||"").toLowerCase().trim();
    for (const [key,b] of Object.entries(BANNERS)) { if (k.includes(key)||key.includes(k)) return b; }
    return {banner:getCatImg(cat),tagline:`Discover ${cat?.name||"Top"} Collections`,highlight:"Verified Escrow Guarantee"};
};

const getSubcats = (cat) => {
    const k = (cat?.name||"").toLowerCase().trim();
    for (const [key,list] of Object.entries(SUBCATS)) { if (k.includes(key)||key.includes(k)) return list; }
    return [{n:"All",i:"apps",q:""},{n:"Popular",i:"star",q:"popular"},{n:"Deals",i:"pricetag",q:"deals"},{n:"New",i:"sparkles",q:"new"}];
};

const getEmoji = (cat) => {
    const k = (cat?.name||"").toLowerCase().trim();
    for (const [key,em] of Object.entries(EMOJI)) { if (k.includes(key)||key.includes(k)) return em; }
    return "🛍️";
};

const fmtN = (n) => { const x=Number(n); return x?`₦${x.toLocaleString()}`:"₦0"; };

const getProdImg = (p) => {
    if (p?.image_url) return p.image_url;
    if (Array.isArray(p?.images)&&p.images.length>0) return p.images[0];
    if (typeof p?.images==="string") { try { const a=JSON.parse(p.images); if (Array.isArray(a)&&a.length>0) return a[0]; } catch(_){} return p.images; }
    return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=300&auto=format&fit=crop";
};

// Shimmer
const Shimmer = ({style}) => {
    const a=useRef(new Animated.Value(0)).current;
    useEffect(()=>{Animated.loop(Animated.sequence([Animated.timing(a,{toValue:1,duration:800,useNativeDriver:true}),Animated.timing(a,{toValue:0,duration:800,useNativeDriver:true})]))  .start();},[]);
    return <Animated.View style={[{backgroundColor:"#EDE8D0",borderRadius:8},style,{opacity:a.interpolate({inputRange:[0,1],outputRange:[0.4,0.85]})}]} />;
};

const Skeleton = () => (
    <View style={{flex:1,flexDirection:"row"}}>
        <View style={{width:RAIL,backgroundColor:"#E4DEC4",paddingTop:8}}>
            {[1,2,3,4,5].map(i=>(
                <View key={i} style={{padding:8,alignItems:"center",gap:5}}>
                    <Shimmer style={{width:48,height:48,borderRadius:13}} />
                    <Shimmer style={{width:56,height:8}} />
                </View>
            ))}
        </View>
        <View style={{flex:1,padding:10,gap:10,backgroundColor:"#FFFEF7"}}>
            <Shimmer style={{height:130,borderRadius:18}} />
            <Shimmer style={{height:32,borderRadius:9}} />
            <View style={{flexDirection:"row",gap:8}}>
                <Shimmer style={{flex:1,height:150,borderRadius:14}} />
                <Shimmer style={{flex:1,height:150,borderRadius:14}} />
            </View>
        </View>
    </View>
);

// Rail Item
const RailItem = React.memo(({cat,isSelected,count,onPress}) => {
    const sc=useRef(new Animated.Value(1)).current;
    const bg=useRef(new Animated.Value(isSelected?1:0)).current;
    useEffect(()=>{Animated.timing(bg,{toValue:isSelected?1:0,duration:180,useNativeDriver:false}).start();},[isSelected]);
    const press=()=>{
        Animated.sequence([Animated.timing(sc,{toValue:0.9,duration:70,useNativeDriver:true}),Animated.spring(sc,{toValue:1,speed:28,bounciness:10,useNativeDriver:true})]).start();
        onPress();
    };
    const bgC=bg.interpolate({inputRange:[0,1],outputRange:["transparent","#FFFFFF"]});
    return (
        <Pressable onPress={press} android_ripple={{color:"rgba(217,167,58,0.15)"}}>
            <Animated.View style={[s.rItem,{backgroundColor:bgC}]}>
                {isSelected&&<View style={s.rPill}/>}
                <Animated.View style={[s.rImgBox,isSelected&&s.rImgBoxOn,{transform:[{scale:sc}]}]}>
                    <Image source={{uri:getCatImg(cat)}} style={s.rImg}/>
                </Animated.View>
                <Text numberOfLines={2} style={[s.rLbl,isSelected&&s.rLblOn]}>{cat.name}</Text>
                {count>0&&<View style={[s.rCount,isSelected&&s.rCountOn]}><Text style={[s.rCountTxt,isSelected&&s.rCountTxtOn]}>{count}</Text></View>}
            </Animated.View>
        </Pressable>
    );
});

// Product Card
const ProdCard = React.memo(({prod,onPress,onAdd,cw}) => {
    const sc=useRef(new Animated.Value(1)).current;
    const addSc=useRef(new Animated.Value(1)).current;
    const hasDisc=Number(prod.compare_at_price)>Number(prod.price);
    const pct=hasDisc?Math.round(((Number(prod.compare_at_price)-Number(prod.price))/Number(prod.compare_at_price))*100):0;
    const onIn=()=>Animated.spring(sc,{toValue:0.95,speed:50,useNativeDriver:true}).start();
    const onOut=()=>Animated.spring(sc,{toValue:1,speed:50,useNativeDriver:true}).start();
    const doAdd=()=>{
        Animated.sequence([Animated.timing(addSc,{toValue:1.4,duration:100,useNativeDriver:true}),Animated.spring(addSc,{toValue:1,speed:22,bounciness:12,useNativeDriver:true})]).start();
        onAdd&&onAdd(prod);
    };
    return (
        <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} android_ripple={{color:"rgba(217,167,58,0.12)"}}>
            <Animated.View style={[s.pCard,{width:cw,transform:[{scale:sc}]}]}>
                <View style={s.pImgBox}>
                    <Image source={{uri:getProdImg(prod)}} style={s.pImg} resizeMode="cover"/>
                    {hasDisc&&<View style={s.pDisc}><Text style={s.pDiscTxt}>-{pct}%</Text></View>}
                </View>
                <View style={s.pBody}>
                    <Text numberOfLines={2} style={s.pName}>{prod.name}</Text>
                    {prod.rating>0&&(
                        <View style={s.ratingRow}>
                            <Ionicons name="star" size={9} color="#D9A73A"/>
                            <Text style={s.ratingTxt}>{Number(prod.rating).toFixed(1)}</Text>
                        </View>
                    )}
                    <View style={s.pPriceRow}>
                        <Text style={s.pPrice}>{fmtN(prod.price)}</Text>
                        <Pressable onPress={doAdd}>
                            <Animated.View style={[s.addBtn,{transform:[{scale:addSc}]}]}>
                                <Ionicons name="add" size={16} color="#0A192F"/>
                            </Animated.View>
                        </Pressable>
                    </View>
                    {hasDisc&&<Text style={s.strikeP}>{fmtN(prod.compare_at_price)}</Text>}
                </View>
            </Animated.View>
        </Pressable>
    );
});

// Subcat Chip
const Chip = React.memo(({sub,isActive,onPress}) => {
    const sc=useRef(new Animated.Value(1)).current;
    const tap=()=>{
        Animated.sequence([Animated.timing(sc,{toValue:0.88,duration:60,useNativeDriver:true}),Animated.spring(sc,{toValue:1,speed:28,bounciness:10,useNativeDriver:true})]).start();
        onPress();
    };
    return (
        <Pressable onPress={tap}>
            <Animated.View style={[s.chip,isActive&&s.chipOn,{transform:[{scale:sc}]}]}>
                <Ionicons name={sub.i||"apps"} size={10} color={isActive?"#0A192F":"#6B7280"} style={{marginRight:3}}/>
                <Text style={[s.chipTxt,isActive&&s.chipTxtOn]}>{sub.n}</Text>
            </Animated.View>
        </Pressable>
    );
});

// Grid Card
const GCard = React.memo(({cat,count,onPress}) => {
    const sc=useRef(new Animated.Value(1)).current;
    const onIn=()=>Animated.spring(sc,{toValue:0.93,speed:55,useNativeDriver:true}).start();
    const onOut=()=>Animated.spring(sc,{toValue:1,speed:55,useNativeDriver:true}).start();
    return (
        <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut}>
            <Animated.View style={[s.gCard,{transform:[{scale:sc}]}]}>
                <View style={s.gImgBox}>
                    <Image source={{uri:getCatImg(cat)}} style={s.gImg} resizeMode="cover"/>
                    <LinearGradient colors={["transparent","rgba(10,25,47,0.85)"]} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.3}} end={{x:0,y:1}}/>
                    <Text style={s.gEmoji}>{getEmoji(cat)}</Text>
                </View>
                <Text numberOfLines={2} style={s.gTitle}>{cat.name}</Text>
                <Text style={s.gCount}>{count>0?`${count} items`:"Explore"}</Text>
            </Animated.View>
        </Pressable>
    );
});

// ═══════ MAIN ═══════
export const CategoriesPage = ({onSelectCategory,onGoToCart,cartCount=0,onProductClick,onAddToCart,onGoToShop,onNavigate}) => {
    const [sq,setSq]=useState(""); // search query
    const [vm,setVm]=useState("explorer"); // view mode
    const [cats,setCats]=useState([]);
    const [selCat,setSelCat]=useState(null);
    const [activeSub,setActiveSub]=useState(null);
    const [prods,setProds]=useState([]);
    const [counts,setCounts]=useState({});
    const [loading,setLoading]=useState(true);
    const [refreshing,setRefreshing]=useState(false);
    const [toastMsg,setToastMsg]=useState("");

    const toastA=useRef(new Animated.Value(0)).current;
    const cartA=useRef(new Animated.Value(1)).current;
    const modeA=useRef(new Animated.Value(0)).current;
    const sfA=useRef(new Animated.Value(0)).current; // search focus

    const toast=(msg)=>{
        setToastMsg(msg);
        Animated.sequence([Animated.spring(toastA,{toValue:1,speed:20,bounciness:12,useNativeDriver:true}),Animated.delay(2000),Animated.timing(toastA,{toValue:0,duration:220,useNativeDriver:true})]).start();
    };

    const bounceCart=()=>{
        Animated.sequence([Animated.timing(cartA,{toValue:1.35,duration:100,useNativeDriver:true}),Animated.spring(cartA,{toValue:1,speed:22,bounciness:10,useNativeDriver:true})]).start();
    };

    const switchVm=(m)=>{
        Animated.timing(modeA,{toValue:m==="explorer"?0:1,duration:200,useNativeDriver:false}).start();
        setVm(m);
    };

    useEffect(()=>{
        fetchD();
        const ch=supabase.channel("cats-v3")
            .on("postgres_changes",{event:"*",schema:"public",table:"categories"},()=>fetchD(true))
            .on("postgres_changes",{event:"*",schema:"public",table:"products"},()=>fetchD(true))
            .subscribe();
        return ()=>supabase.removeChannel(ch);
    },[]);

    const fetchD=async(silent=false)=>{
        if(!silent)setLoading(true);
        try {
            const [cr,pr]=await Promise.allSettled([
                supabase.from("categories").select("*").eq("is_active",true).order("display_order",{ascending:true,nullsFirst:false}),
                supabase.from("products").select("id,name,description,price,compare_at_price,image_url,images,category,rating,reviews,stock,total_sales,status,created_at").eq("status","approved").order("created_at",{ascending:false}).limit(150),
            ]);
            const cl=cr.status==="fulfilled"&&Array.isArray(cr.value?.data)?cr.value.data:[];
            const pl=pr.status==="fulfilled"&&Array.isArray(pr.value?.data)?pr.value.data:[];
            setCats(cl); setProds(pl);
            const c={};
            pl.forEach(p=>{if(p.category){const k=p.category.toLowerCase().trim();c[k]=(c[k]||0)+1;}});
            setCounts(c);
            setSelCat(prev=>{
                if(!prev&&cl.length>0)return cl[0];
                if(prev)return cl.find(c=>c.id===prev.id)||cl[0];
                return prev;
            });
        } catch(e){console.log("[CatPage]",e);}
        finally{setLoading(false);setRefreshing(false);}
    };

    const onRefresh=()=>{setRefreshing(true);fetchD(true);};
    const doWA=(cat)=>{const m=encodeURIComponent(`Hello Abu Mafhal, help me find "${cat?.name||"items"}".`);Linking.openURL(`https://wa.me/2349021486162?text=${m}`).catch(()=>{});};
    const doAdd=(p)=>{if(onAddToCart){onAddToCart(p);bounceCart();toast(`Added "${p.name}" to cart`);}};
    const doSel=useCallback((cat)=>{setSelCat(cat);setActiveSub(null);},[]);

    const fCats=cats.filter(c=>(c.name||"").toLowerCase().includes(sq.toLowerCase()));
    const fProds=prods.filter(p=>{
        if(!selCat)return true;
        const cn=(selCat.name||"").toLowerCase().trim();
        const pc=(p.category||"").toLowerCase().trim();
        if(!(pc.includes(cn)||cn.includes(pc)))return false;
        if(activeSub?.q){const q=activeSub.q.toLowerCase();return(p.name||"").toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q);}
        return true;
    });

    const subs=selCat?getSubcats(selCat):[];
    const banner=selCat?getBanner(selCat):null;
    const emoji=selCat?getEmoji(selCat):"🛍️";
    const CW=(width-RAIL-24-8)/2;

    const sliderL=modeA.interpolate({inputRange:[0,1],outputRange:[3,3+(width*0.26)/2]});
    const sBC=sfA.interpolate({inputRange:[0,1],outputRange:["#E8D99A","#D9A73A"]});

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor="#0A192F" translucent/>

            {/* HEADER */}
            <LinearGradient colors={["#0A192F","#0E2340","#071422"]} style={s.hdr} start={{x:0,y:0}} end={{x:1,y:1}}>
                <View style={s.goldLine}/>
                <View style={s.hRow}>
                    <View style={s.brand}>
                        <LinearGradient colors={["#D9A73A","#A07820"]} style={s.logo}><Text style={{fontSize:16}}>🛍️</Text></LinearGradient>
                        <View>
                            <View style={s.bTitleRow}>
                                <Text style={s.bTitle}>ABU <Text style={s.bAccent}>MAFHAL</Text></Text>
                                <View style={s.dPill}><Text style={s.dPillTxt}>DEPTS</Text></View>
                            </View>
                            <Text style={s.bSub}>Category Explorer</Text>
                        </View>
                    </View>
                    <View style={s.hRight}>
                        <View style={s.modeWrap}>
                            <Animated.View style={[s.mSlider,{left:sliderL}]}/>
                            <Pressable onPress={()=>switchVm("explorer")} style={s.mBtn}>
                                <Ionicons name="layers" size={12} color={vm==="explorer"?"#0A192F":"#9CA3AF"}/>
                                <Text style={[s.mTxt,vm==="explorer"&&s.mTxtOn]}>Explore</Text>
                            </Pressable>
                            <Pressable onPress={()=>switchVm("grid")} style={s.mBtn}>
                                <Ionicons name="grid" size={11} color={vm==="grid"?"#0A192F":"#9CA3AF"}/>
                                <Text style={[s.mTxt,vm==="grid"&&s.mTxtOn]}>Grid</Text>
                            </Pressable>
                        </View>
                        <Pressable onPress={onGoToCart} android_ripple={{color:"rgba(217,167,58,0.2)",radius:20,borderless:true}}>
                            <Animated.View style={[s.cartBtn,{transform:[{scale:cartA}]}]}>
                                <Ionicons name="cart" size={21} color="#FFFFFF"/>
                                {cartCount>0&&<LinearGradient colors={["#F5C842","#D9A73A"]} style={s.cartBadge}><Text style={s.cartBTxt}>{cartCount>99?"99+":cartCount}</Text></LinearGradient>}
                            </Animated.View>
                        </Pressable>
                    </View>
                </View>
                <Animated.View style={[s.sWrap,{borderColor:sBC}]}>
                    <Ionicons name="search" size={14} color="#9CA3AF"/>
                    <TextInput placeholder="Search categories..." placeholderTextColor="#6B7280" value={sq} onChangeText={setSq} style={s.sInput}
                        onFocus={()=>Animated.timing(sfA,{toValue:1,duration:180,useNativeDriver:false}).start()}
                        onBlur={()=>Animated.timing(sfA,{toValue:0,duration:180,useNativeDriver:false}).start()}/>
                    {sq.length>0&&<Pressable onPress={()=>setSq("")} hitSlop={10}><Ionicons name="close-circle" size={16} color="#6B7280"/></Pressable>}
                </Animated.View>
            </LinearGradient>

            {/* BODY */}
            {loading&&!refreshing?<Skeleton/>:vm==="explorer"?(
                <View style={s.exWrap}>
                    {/* RAIL */}
                    <ScrollView style={s.rail} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:6,paddingBottom:120}}>
                        {fCats.map(cat=>(
                            <RailItem key={cat.id} cat={cat} isSelected={selCat?.id===cat.id}
                                count={counts[(cat.name||"").toLowerCase().trim()]||0}
                                onPress={()=>doSel(cat)}/>
                        ))}
                    </ScrollView>

                    {/* SHOWCASE */}
                    <ScrollView style={s.show} showsVerticalScrollIndicator={false} contentContainerStyle={s.showContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D9A73A" colors={["#D9A73A"]}/>}>
                        {selCat&&(
                            <>
                                {/* Hero Banner */}
                                <Pressable onPress={()=>onSelectCategory?onSelectCategory(selCat.name):onGoToShop&&onGoToShop(selCat.name)} style={s.hero}>
                                    <Image source={{uri:banner.banner}} style={s.heroImg}/>
                                    <LinearGradient colors={["transparent","rgba(10,25,47,0.7)","rgba(10,25,47,0.97)"]} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:0,y:1}}/>
                                    <View style={s.heroContent}>
                                        <View style={s.heroBadge}><Text style={s.heroBadgeTxt}>✦ {banner.highlight}</Text></View>
                                        <View>
                                            <Text style={{fontSize:20,marginBottom:2}}>{emoji}</Text>
                                            <Text style={s.heroTitle} numberOfLines={1}>{selCat.name}</Text>
                                            <Text style={s.heroSub} numberOfLines={1}>{banner.tagline}</Text>
                                        </View>
                                        <LinearGradient colors={["#D9A73A","#A07820"]} style={s.heroCta} start={{x:0,y:0}} end={{x:1,y:0}}>
                                            <Text style={s.heroCtaTxt}>Shop Now</Text>
                                            <Ionicons name="arrow-forward" size={11} color="#0A192F"/>
                                        </LinearGradient>
                                    </View>
                                </Pressable>

                                {/* Subcats */}
                                <View style={s.subcatSec}>
                                    <View style={s.secRow}><View style={s.dot}/><Text style={s.secLbl}>FILTER</Text></View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                                        {subs.map((sub,i)=>(
                                            <Chip key={i} sub={sub}
                                                isActive={activeSub?.n===sub.n||(!activeSub&&i===0)}
                                                onPress={()=>sub.q===""?setActiveSub(null):setActiveSub(sub)}/>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Products */}
                                <View style={s.prodSec}>
                                    <View style={s.prodHdr}>
                                        <View style={s.secRow}>
                                            <View style={s.dot}/>
                                            <Text style={s.secLbl}>IN-STOCK</Text>
                                            <View style={s.cBubble}><Text style={s.cBubbleTxt}>{fProds.length}</Text></View>
                                        </View>
                                        <Pressable onPress={()=>onSelectCategory?onSelectCategory(selCat.name):onGoToShop&&onGoToShop(selCat.name)} style={s.seeAll}>
                                            <Text style={s.seeAllTxt}>See all</Text>
                                            <Ionicons name="chevron-forward" size={10} color="#A07820"/>
                                        </Pressable>
                                    </View>
                                    {fProds.length===0?(
                                        <View style={s.emptyBox}>
                                            <Text style={{fontSize:32,marginBottom:6}}>📦</Text>
                                            <Text style={s.emptyT}>No items match</Text>
                                            <Text style={s.emptyS}>Try another filter</Text>
                                            <Pressable onPress={()=>onSelectCategory?onSelectCategory(selCat.name):onGoToShop&&onGoToShop(selCat.name)} style={s.emptyBtn}>
                                                <Text style={s.emptyBtnT}>Browse All</Text>
                                            </Pressable>
                                        </View>
                                    ):(
                                        <View style={s.grid}>
                                            {fProds.slice(0,10).map(p=>(
                                                <ProdCard key={p.id} prod={p} cw={CW}
                                                    onPress={()=>onProductClick&&onProductClick(p)}
                                                    onAdd={doAdd}/>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                {/* WhatsApp */}
                                <Pressable onPress={()=>doWA(selCat)} style={s.wa}>
                                    <View style={s.waIcon}><Ionicons name="logo-whatsapp" size={18} color="#25D366"/></View>
                                    <View style={{flex:1}}>
                                        <Text style={s.waTitle}>Need help with {selCat.name}?</Text>
                                        <Text style={s.waSub}>Chat on WhatsApp</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={13} color="#059669"/>
                                </Pressable>
                                <View style={{height:16}}/>
                            </>
                        )}
                    </ScrollView>
                </View>
            ):(
                /* GRID */
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.gridCont}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D9A73A" colors={["#D9A73A"]}/>}>
                    <LinearGradient colors={["#0A192F","#1B3358"]} style={s.statsBar} start={{x:0,y:0}} end={{x:1,y:0}}>
                        <View style={s.si}><Text style={s.sn}>{fCats.length}</Text><Text style={s.sl}>Depts</Text></View>
                        <View style={s.sdiv}/>
                        <View style={s.si}><Text style={s.sn}>{prods.length}</Text><Text style={s.sl}>Products</Text></View>
                        <View style={s.sdiv}/>
                        <View style={s.si}><Text style={s.sn}>✓</Text><Text style={s.sl}>Verified</Text></View>
                    </LinearGradient>
                    <View style={[s.secRow,{marginBottom:10}]}><View style={s.dot}/><Text style={[s.secLbl,{color:"#0A192F"}]}>ALL DEPARTMENTS</Text></View>
                    <View style={s.gWrap}>
                        {fCats.map(cat=>(
                            <GCard key={cat.id} cat={cat}
                                count={counts[(cat.name||"").toLowerCase().trim()]||0}
                                onPress={()=>{doSel(cat);switchVm("explorer");}}/>
                        ))}
                    </View>
                </ScrollView>
            )}

            {/* TOAST */}
            <Animated.View pointerEvents="none" style={[s.toast,{opacity:toastA,transform:[{translateY:toastA.interpolate({inputRange:[0,1],outputRange:[16,0]})}]}]}>
                <LinearGradient colors={["#0E2340","#0A192F"]} style={s.toastIn} start={{x:0,y:0}} end={{x:1,y:0}}>
                    <Ionicons name="checkmark-circle" size={16} color="#D9A73A"/>
                    <Text style={s.toastTxt} numberOfLines={1}>{toastMsg}</Text>
                </LinearGradient>
            </Animated.View>
        </View>
    );
};

const s = StyleSheet.create({
    root:{flex:1,backgroundColor:"#F9F5EB"},
    // Header
    hdr:{paddingTop:Platform.OS==="ios"?52:44,paddingHorizontal:14,paddingBottom:12},
    goldLine:{height:2,backgroundColor:"#D9A73A",width:50,borderRadius:2,marginBottom:12,opacity:0.65},
    hRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:11},
    brand:{flexDirection:"row",alignItems:"center",gap:9},
    logo:{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center"},
    bTitleRow:{flexDirection:"row",alignItems:"center",gap:5},
    bTitle:{color:"#FFFFFF",fontSize:15,fontWeight:"900",letterSpacing:0.4},
    bAccent:{color:"#D9A73A"},
    dPill:{backgroundColor:"rgba(217,167,58,0.18)",paddingHorizontal:5,paddingVertical:1.5,borderRadius:5,borderWidth:1,borderColor:"rgba(217,167,58,0.3)"},
    dPillTxt:{color:"#D9A73A",fontSize:7.5,fontWeight:"900",letterSpacing:0.4},
    bSub:{color:"#8A9AB0",fontSize:10,fontWeight:"600",marginTop:1},
    hRight:{flexDirection:"row",alignItems:"center",gap:7},
    // Mode toggle
    modeWrap:{flexDirection:"row",backgroundColor:"rgba(255,255,255,0.08)",borderRadius:11,padding:3,borderWidth:1,borderColor:"rgba(255,255,255,0.14)",position:"relative",overflow:"hidden"},
    mSlider:{position:"absolute",top:3,height:"84%",width:"48%",backgroundColor:"#D9A73A",borderRadius:8,zIndex:0},
    mBtn:{flexDirection:"row",alignItems:"center",paddingHorizontal:7,paddingVertical:5,gap:2.5,zIndex:1},
    mTxt:{fontSize:10,fontWeight:"700",color:"#9CA3AF"},
    mTxtOn:{color:"#0A192F"},
    // Cart
    cartBtn:{width:38,height:38,borderRadius:19,backgroundColor:"rgba(255,255,255,0.09)",borderWidth:1,borderColor:"rgba(255,255,255,0.16)",alignItems:"center",justifyContent:"center"},
    cartBadge:{position:"absolute",top:-4,right:-5,borderRadius:9,minWidth:17,height:17,alignItems:"center",justifyContent:"center",paddingHorizontal:2.5,borderWidth:1.5,borderColor:"#0A192F"},
    cartBTxt:{color:"#0A192F",fontSize:8.5,fontWeight:"900"},
    // Search
    sWrap:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF",borderRadius:14,paddingHorizontal:11,height:42,borderWidth:1.5,gap:7,elevation:3},
    sInput:{flex:1,fontSize:13,color:"#1F2937",fontWeight:"600",paddingVertical:0},
    // Explorer
    exWrap:{flex:1,flexDirection:"row"},
    // Rail
    rail:{width:RAIL,backgroundColor:"#E4DEC4",borderRightWidth:1,borderRightColor:"#D0C99C"},
    rItem:{paddingVertical:11,paddingHorizontal:6,alignItems:"center",position:"relative",borderBottomWidth:1,borderBottomColor:"#D0C99C"},
    rPill:{position:"absolute",left:0,top:10,bottom:10,width:3.5,backgroundColor:"#D9A73A",borderTopRightRadius:3.5,borderBottomRightRadius:3.5},
    rImgBox:{width:48,height:48,borderRadius:13,backgroundColor:"#FFFFFF",overflow:"hidden",marginBottom:5,borderWidth:1.5,borderColor:"#D0C99C",position:"relative"},
    rImgBoxOn:{borderColor:"#D9A73A",elevation:3},
    rImg:{width:"100%",height:"100%",resizeMode:"cover"},
    rLbl:{fontSize:9.5,fontWeight:"700",color:"#6B7280",textAlign:"center",lineHeight:12},
    rLblOn:{color:"#A07820",fontWeight:"900"},
    rCount:{marginTop:3,backgroundColor:"#D0C99C",paddingHorizontal:5,paddingVertical:1,borderRadius:7},
    rCountOn:{backgroundColor:"rgba(217,167,58,0.2)"},
    rCountTxt:{fontSize:8.5,fontWeight:"800",color:"#6B7280"},
    rCountTxtOn:{color:"#A07820"},
    // Showcase
    show:{flex:1,backgroundColor:"#FFFFFF"},
    showContent:{padding:10,paddingBottom:130},
    // Hero
    hero:{height:140,borderRadius:18,overflow:"hidden",marginBottom:12,backgroundColor:"#0A192F",elevation:4},
    heroImg:{...StyleSheet.absoluteFillObject,width:"100%",height:"100%",opacity:0.5},
    heroContent:{flex:1,padding:12,justifyContent:"space-between"},
    heroBadge:{alignSelf:"flex-start",backgroundColor:"rgba(217,167,58,0.2)",paddingHorizontal:8,paddingVertical:2.5,borderRadius:7,borderWidth:1,borderColor:"rgba(217,167,58,0.35)"},
    heroBadgeTxt:{color:"#D9A73A",fontSize:8.5,fontWeight:"800"},
    heroTitle:{color:"#FFFFFF",fontSize:16,fontWeight:"900",letterSpacing:-0.2},
    heroSub:{color:"rgba(255,255,255,0.75)",fontSize:10.5,fontWeight:"600",marginTop:1},
    heroCta:{flexDirection:"row",alignItems:"center",gap:4,alignSelf:"flex-start",paddingHorizontal:11,paddingVertical:5.5,borderRadius:11,elevation:3},
    heroCtaTxt:{color:"#0A192F",fontSize:11,fontWeight:"900"},
    // Section labels
    secRow:{flexDirection:"row",alignItems:"center",gap:5,marginBottom:7},
    dot:{width:4.5,height:4.5,borderRadius:2.5,backgroundColor:"#D9A73A"},
    secLbl:{fontSize:10,fontWeight:"900",color:"#6B7280",letterSpacing:0.6,textTransform:"uppercase"},
    // Subcat section
    subcatSec:{marginBottom:12},
    chipRow:{gap:6,paddingBottom:2,flexDirection:"row"},
    chip:{flexDirection:"row",alignItems:"center",backgroundColor:"#F0EDD6",paddingHorizontal:10,paddingVertical:6,borderRadius:11,borderWidth:1,borderColor:"#E8D99A"},
    chipOn:{backgroundColor:"#0A192F",borderColor:"#D9A73A"},
    chipTxt:{fontSize:10.5,fontWeight:"700",color:"#1F2937"},
    chipTxtOn:{color:"#D9A73A"},
    // Products
    prodSec:{marginBottom:14},
    prodHdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:9},
    cBubble:{backgroundColor:"rgba(217,167,58,0.18)",paddingHorizontal:6,paddingVertical:1,borderRadius:7,borderWidth:1,borderColor:"rgba(217,167,58,0.3)",marginLeft:4},
    cBubbleTxt:{fontSize:9.5,fontWeight:"800",color:"#A07820"},
    seeAll:{flexDirection:"row",alignItems:"center",gap:1.5},
    seeAllTxt:{fontSize:11,color:"#A07820",fontWeight:"800"},
    grid:{flexDirection:"row",flexWrap:"wrap",gap:8},
    // Product card
    pCard:{backgroundColor:"#FFFFFF",borderRadius:14,overflow:"hidden",borderWidth:1,borderColor:"#EEE5C0",elevation:2},
    pImgBox:{width:"100%",height:105,backgroundColor:"#F9F5EB",position:"relative"},
    pImg:{width:"100%",height:"100%"},
    pDisc:{position:"absolute",top:6,left:6,backgroundColor:"#D9A73A",paddingHorizontal:5,paddingVertical:2,borderRadius:7},
    pDiscTxt:{color:"#0A192F",fontSize:8.5,fontWeight:"900"},
    pBody:{padding:8},
    pName:{fontSize:11,fontWeight:"700",color:"#1F2937",lineHeight:14,marginBottom:3,minHeight:28},
    ratingRow:{flexDirection:"row",alignItems:"center",gap:2,marginBottom:3},
    ratingTxt:{fontSize:9.5,fontWeight:"800",color:"#D9A73A"},
    pPriceRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
    pPrice:{fontSize:12.5,fontWeight:"900",color:"#0A192F"},
    strikeP:{fontSize:9,color:"#9CA3AF",textDecorationLine:"line-through",fontWeight:"600",marginTop:1},
    addBtn:{width:27,height:27,borderRadius:13.5,backgroundColor:"#D9A73A",alignItems:"center",justifyContent:"center",elevation:3},
    // Empty
    emptyBox:{paddingVertical:36,alignItems:"center",backgroundColor:"#F9F5EB",borderRadius:16,borderWidth:1.5,borderColor:"#E8D99A",borderStyle:"dashed"},
    emptyT:{fontSize:12.5,fontWeight:"800",color:"#1F2937",textAlign:"center"},
    emptyS:{fontSize:10.5,color:"#9CA3AF",marginTop:2,textAlign:"center"},
    emptyBtn:{marginTop:12,backgroundColor:"#0A192F",paddingHorizontal:18,paddingVertical:8,borderRadius:12,borderWidth:1,borderColor:"#D9A73A"},
    emptyBtnT:{color:"#D9A73A",fontSize:11.5,fontWeight:"900"},
    // WhatsApp
    wa:{flexDirection:"row",alignItems:"center",gap:9,backgroundColor:"#ECFDF5",padding:11,borderRadius:15,borderWidth:1,borderColor:"#BBF7D0"},
    waIcon:{width:36,height:36,borderRadius:18,backgroundColor:"#D1FAE5",alignItems:"center",justifyContent:"center"},
    waTitle:{fontSize:11.5,fontWeight:"800",color:"#065F46",lineHeight:15},
    waSub:{fontSize:10,color:"#059669",marginTop:1},
    // Grid mode
    gridCont:{padding:12,paddingBottom:130},
    statsBar:{flexDirection:"row",borderRadius:16,padding:14,marginBottom:14,elevation:4},
    si:{flex:1,alignItems:"center"},
    sn:{fontSize:18,fontWeight:"900",color:"#D9A73A"},
    sl:{fontSize:9.5,color:"#A0B4CC",fontWeight:"700",marginTop:1},
    sdiv:{width:1,backgroundColor:"rgba(255,255,255,0.1)",marginVertical:4},
    gWrap:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:2},
    gCard:{width:(width-24-16)/3,backgroundColor:"#FFFFFF",borderRadius:16,overflow:"hidden",borderWidth:1,borderColor:"#EEE5C0",elevation:2,marginBottom:2},
    gImgBox:{width:"100%",height:82,position:"relative",alignItems:"center",justifyContent:"flex-end",paddingBottom:5},
    gImg:{...StyleSheet.absoluteFillObject,width:"100%",height:"100%",resizeMode:"cover"},
    gEmoji:{fontSize:22,zIndex:1},
    gTitle:{fontSize:10.5,fontWeight:"800",color:"#1F2937",textAlign:"center",paddingHorizontal:5,paddingTop:6,lineHeight:13,minHeight:26},
    gCount:{fontSize:9,fontWeight:"700",color:"#A07820",textAlign:"center",paddingBottom:8,paddingTop:2},
    // Toast
    toast:{position:"absolute",bottom:95,left:14,right:14,alignItems:"center",zIndex:9999},
    toastIn:{flexDirection:"row",alignItems:"center",gap:9,paddingVertical:12,paddingHorizontal:16,borderRadius:18,elevation:9,borderWidth:1,borderColor:"rgba(217,167,58,0.3)",width:"100%"},
    toastTxt:{color:"#FFFFFF",fontSize:12.5,fontWeight:"700",flex:1},
});
