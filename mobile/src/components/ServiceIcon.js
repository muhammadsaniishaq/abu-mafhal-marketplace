import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

export const ServiceIcon = ({ icon, label, color, lib, onPress }) => (
    <TouchableOpacity style={styles.serviceItem} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.serviceIconBox, { backgroundColor: color }]}>
            {lib === 'fa5' ? <FontAwesome5 name={icon} size={18} color="white" /> :
                lib === 'mc' ? <MaterialCommunityIcons name={icon} size={20} color="white" /> :
                    <Ionicons name={icon} size={20} color="white" />}
        </View>
        <Text style={styles.serviceText}>{label}</Text>
    </TouchableOpacity>
);
