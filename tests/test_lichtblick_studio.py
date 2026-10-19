"""HTTP and static asset smoke tests for the source-labeled studio."""
import unittest
from scripts.serve_dashboard import response_for


class TestStudioRoutes(unittest.TestCase):
    def test_studio_document(self):
        status, media, body = response_for("/studio")
        self.assertEqual(status, 200)
        self.assertIn("text/html", media)
        self.assertIn(b"Mission intelligence", body)
        self.assertIn(b"READ-ONLY ANALYSIS", body)

    def test_studio_assets(self):
        for path, kind in [
            ("/lichtblick-studio.css", "text/css"),
            ("/lichtblick-studio.js", "text/javascript"),
        ]:
            with self.subTest(path=path):
                status, media, body = response_for(path)
                self.assertEqual(status, 200)
                self.assertEqual(media, kind)
                self.assertGreater(len(body), 100)

    def test_no_control_endpoint(self):
        status, _, _ = response_for("/api/dispatch")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
