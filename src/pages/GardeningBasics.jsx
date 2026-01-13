import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Sprout, Droplets, Bug, Sun } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const GUIDES = [
  {
    id: 'starting-seeds',
    title: 'Starting Seeds Indoors',
    icon: Sprout,
    color: 'text-green-600',
    content: `
**What You'll Need:**
- Seed starting trays or pots
- Seed starting mix (not garden soil)
- Seeds
- Water spray bottle
- Grow lights or sunny window
- Heat mat (optional but helpful)

**Steps:**
1. Fill containers with moistened seed starting mix
2. Plant seeds at recommended depth (usually 2x seed size)
3. Cover with plastic dome or wrap to retain moisture
4. Place under lights or in sunny window
5. Keep soil moist but not waterlogged
6. Remove cover once seeds sprout
7. Provide 14-16 hours of light daily

**Common Mistakes:**
- Using garden soil (too heavy, may contain diseases)
- Planting too deep or too shallow
- Not enough light (causes leggy seedlings)
- Overwatering (causes damping off disease)
    `
  },
  {
    id: 'transplanting',
    title: 'Transplanting Seedlings',
    icon: Sprout,
    color: 'text-blue-600',
    content: `
**When to Transplant:**
- Seedlings have 2-4 true leaves
- Weather is warm enough (check frost dates)
- Soil temperature is appropriate for crop

**Hardening Off (7-10 days before):**
1. Day 1-2: Place outside in shade for 1-2 hours
2. Day 3-4: Increase to 3-4 hours, some sun
3. Day 5-6: Full day outside, bring in at night
4. Day 7+: Leave out overnight if temperatures allow

**Transplanting Steps:**
1. Water seedlings well before transplanting
2. Dig holes larger than root ball
3. Gently remove seedling, keeping root ball intact
4. Plant at same depth (tomatoes can go deeper)
5. Water thoroughly
6. Protect from harsh sun for first few days

**Best Practices:**
- Transplant on cloudy day or evening
- Handle by leaves, not stem
- Space according to mature size
- Mulch after transplanting
    `
  },
  {
    id: 'watering',
    title: 'Watering & Fertilizing',
    icon: Droplets,
    color: 'text-blue-600',
    content: `
**Watering Guidelines:**
- Water deeply and less frequently (encourages deep roots)
- 1-2 inches per week for most vegetables
- Morning watering reduces disease
- Use drip irrigation or soaker hoses when possible
- Mulch to retain moisture

**Signs of Overwatering:**
- Yellowing leaves
- Wilting despite wet soil
- Fungal growth

**Signs of Underwatering:**
- Wilting, crispy leaves
- Slow growth
- Blossom end rot (tomatoes, peppers)

**Fertilizing:**
- Use balanced fertilizer (10-10-10) for most plants
- Side-dress heavy feeders (tomatoes, corn) mid-season
- Foliar feed for quick nutrient boost
- Compost is excellent all-purpose fertilizer
- Don't over-fertilize (causes leafy growth, fewer fruits)
    `
  },
  {
    id: 'pest-control',
    title: 'Pest & Disease Management',
    icon: Bug,
    color: 'text-orange-600',
    content: `
**Prevention (Best Defense):**
- Healthy soil = healthy plants
- Proper spacing (air circulation)
- Crop rotation
- Companion planting
- Remove diseased plants promptly
- Clean garden debris

**Common Pests & Solutions:**

**Aphids:**
- Spray with water
- Release ladybugs
- Neem oil or insecticidal soap

**Tomato Hornworms:**
- Hand-pick
- Encourage parasitic wasps

**Squash Vine Borers:**
- Wrap stems with foil
- Succession planting

**Cabbage Worms:**
- Row covers
- Bt spray (organic)
- Hand-pick

**Common Diseases:**

**Powdery Mildew:**
- Improve air circulation
- Spray with milk solution (1:10)
- Remove affected leaves

**Blight (tomatoes):**
- Mulch to prevent soil splash
- Don't water from above
- Stake plants
- Remove affected parts

**Organic Pest Control:**
- Neem oil
- Insecticidal soap
- Diatomaceous earth
- Row covers
- Companion planting
    `
  },
  {
    id: 'tools',
    title: 'Essential Garden Tools',
    icon: Sun,
    color: 'text-yellow-600',
    content: `
**Must-Have Tools:**

**For Planting:**
- Garden trowel
- Hand fork
- Dibber or pencil (for seed holes)
- Watering can with rose attachment
- Garden hose with spray nozzle

**For Maintenance:**
- Hand pruners (bypass style)
- Garden hoe
- Cultivator/hand rake
- Garden fork
- Weeding tool

**For Harvesting:**
- Garden scissors or snips
- Harvest basket or bucket
- Garden knife

**Nice to Have:**
- Wheelbarrow or garden cart
- Kneeling pad
- Garden gloves
- Soil knife (hori hori)
- Soil thermometer
- pH tester

**Tool Care:**
- Clean after each use
- Sharpen blades regularly
- Oil metal parts to prevent rust
- Store in dry location
    `
  }
];

export default function GardeningBasics() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold">Gardening Basics</h1>
          <p className="text-gray-600 text-sm">Essential guides for new gardeners</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {GUIDES.map(guide => {
          const Icon = guide.icon;
          return (
            <AccordionItem key={guide.id} value={guide.id} className="border rounded-lg">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${guide.color}`} />
                  <span className="font-semibold">{guide.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="prose prose-sm max-w-none">
                  {guide.content.split('\n').map((line, idx) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <h3 key={idx} className="font-semibold mt-4 mb-2">{line.replace(/\*\*/g, '')}</h3>;
                    } else if (line.startsWith('- ')) {
                      return <li key={idx} className="ml-4">{line.substring(2)}</li>;
                    } else if (line.trim()) {
                      return <p key={idx} className="mb-2">{line}</p>;
                    }
                    return null;
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>More Resources Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-sm">
            We're continuously adding more guides, videos, and tutorials. Check back often!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}