import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const CountdownTimer = ({ targetDate }) => {
    const calculateTimeLeft = () => {
        // Default target is 2 days from now if not passed
        const target = targetDate ? +new Date(targetDate) : (+new Date() + (2 * 24 * 3600 * 1000 + 14 * 3600 * 1000 + 27 * 60 * 1000 + 36 * 1000));
        const difference = target - +new Date();
        let timeLeft = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        } else {
            timeLeft = { days: 2, hours: 14, minutes: 27, seconds: 36 };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    const formatTime = (time) => {
        return time < 10 ? `0${time}` : `${time}`;
    };

    const UNITS = [
        { val: formatTime(timeLeft.days), label: 'Days' },
        { val: formatTime(timeLeft.hours), label: 'Hours' },
        { val: formatTime(timeLeft.minutes), label: 'Mins' },
        { val: formatTime(timeLeft.seconds), label: 'Secs' },
    ];

    return (
        <View style={s.timerContainer}>
            {UNITS.map((item, idx) => (
                <View key={idx} style={s.unitBox}>
                    <View style={s.redBox}>
                        <Text style={s.numberTxt}>{item.val}</Text>
                    </View>
                    <Text style={s.labelTxt}>{item.label}</Text>
                </View>
            ))}
        </View>
    );
};

const s = StyleSheet.create({
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    unitBox: {
        alignItems: 'center',
    },
    redBox: {
        backgroundColor: '#EF4444',
        width: 34,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    numberTxt: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 12.5,
    },
    labelTxt: {
        fontSize: 8.5,
        color: '#64748B',
        fontWeight: '700',
        marginTop: 2,
    },
});
