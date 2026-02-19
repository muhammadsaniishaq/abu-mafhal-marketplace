import React, { useEffect, useRef, useState } from 'react';
import { FlatList, View, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const AutoScrollList = ({ data, renderItem, itemWidth, interval = 3000, contentContainerStyle }) => {
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!data || data.length === 0) return;

        const timer = setInterval(() => {
            let nextIndex = currentIndex + 1;
            if (nextIndex >= data.length) {
                nextIndex = 0;
            }

            flatListRef.current?.scrollToIndex({
                index: nextIndex,
                animated: true,
                viewPosition: 0.5
            });

            setCurrentIndex(nextIndex);
        }, interval);

        return () => clearInterval(timer);
    }, [currentIndex, data, interval]);

    // Handle manual scroll updates to prevent fighting the auto-scroll
    const onMomentumScrollEnd = (event) => {
        const newIndex = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
        setCurrentIndex(newIndex);
    };

    return (
        <FlatList
            ref={flatListRef}
            data={data}
            renderItem={renderItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle}
            keyExtractor={(item, index) => index.toString()}
            snapToInterval={itemWidth}
            decelerationRate="fast"
            onMomentumScrollEnd={onMomentumScrollEnd}
            getItemLayout={(data, index) => ({
                length: itemWidth,
                offset: itemWidth * index,
                index,
            })}
        />
    );
};
