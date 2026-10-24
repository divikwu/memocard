import { DayPicker } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import './date-property-picker.css';
import { createDatePropertyPicker } from "./DatePropertyPicker.core";
export default createDatePropertyPicker({ DayPicker, Button, Input, Switch });
