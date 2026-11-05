import { createDatePropertyPicker } from "../../src/DatePropertyPicker.core";
import { Calendar } from "../components/calendar";
import { Button } from "../components/button";
import { Input } from "../components/input";

export const DatePropertyPicker = createDatePropertyPicker({ DayPicker: Calendar, Button, Input });
