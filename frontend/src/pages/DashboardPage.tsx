import { Card, CardContent, Grid2, Typography } from "@mui/material";

const cards = [
  { title: "Open Incidents", value: "12" },
  { title: "P1/P2 Active", value: "3" },
  { title: "TAC Cases Open", value: "7" },
  { title: "Device Health Avg", value: "91%" }
];

export function DashboardPage() {
  return (
    <Grid2 container spacing={2}>
      {cards.map((card) => (
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }} key={card.title}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2">{card.title}</Typography>
              <Typography variant="h4">{card.value}</Typography>
            </CardContent>
          </Card>
        </Grid2>
      ))}
    </Grid2>
  );
}
