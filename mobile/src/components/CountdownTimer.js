import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

export const CountdownTimer = ({ targetDate }) => {
    const calculateTimeLeft = () => {
        const difference = +new Date(targetDate) - +new Date();
        let timeLeft = {};

        if (difference > 0) {
            timeLeft = {
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        } else {
            timeLeft = { hours: 0, minutes: 0, seconds: 0 };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearTimeout(timer);
    });

    const formatTime = (time) => {
        return time < 10 ? `0${time}` : time;
    };

    return (
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>{formatTime(timeLeft.hours)}</Text>
            </View>
            <Text style={{ fontWeight: '800', color: '#EF4444' }}>:</Text>
            <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>{formatTime(timeLeft.minutes)}</Text>
            </View>
            <Text style={{ fontWeight: '800', color: '#EF4444' }}>:</Text>
            <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>{formatTime(timeLeft.seconds)}</Text>
            </View>
        </View>
    );
};
