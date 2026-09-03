import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type WeatherVisual = {
  label: string
  Icon: LucideIcon
}

/** WMO weather-interpretation codes (the set Open-Meteo's `current.weather_code` returns). */
export function describeWeatherCode(code: number, isDay: boolean): WeatherVisual {
  switch (code) {
    case 0:
      return { label: "Clear sky", Icon: isDay ? Sun : Moon }
    case 1:
    case 2:
      return { label: "Partly cloudy", Icon: isDay ? CloudSun : CloudMoon }
    case 3:
      return { label: "Overcast", Icon: Cloud }
    case 45:
    case 48:
      return { label: "Fog", Icon: CloudFog }
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return { label: "Drizzle", Icon: CloudDrizzle }
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return { label: "Rain", Icon: CloudRain }
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return { label: "Snow", Icon: CloudSnow }
    case 95:
    case 96:
    case 99:
      return { label: "Thunderstorm", Icon: CloudLightning }
    default:
      return { label: "Weather", Icon: Cloud }
  }
}
