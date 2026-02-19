import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

export const SectionHeader = ({ title, action }) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && <TouchableOpacity><Text style={styles.sectionLink}>{action} <Ionicons name="chevron-forward" size={12} /></Text></TouchableOpacity>}
    </View>
);
