import '@mantine/core/styles.layer.css';
import { createTheme, MantineProvider } from '@mantine/core';

const catalogueTheme = createTheme({
	primaryColor: 'gray',
	focusRing: 'never'
});

export default function CatalogueLayout({
	children
}: {
	children: React.ReactNode;
}) {
	return (
		<MantineProvider theme={catalogueTheme} defaultColorScheme="auto">
			{children}
		</MantineProvider>
	);
}
