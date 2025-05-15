from setuptools import setup, find_packages

with open('README.md', 'r', encoding='utf-8') as f:
    long_description = f.read()

setup(
    name='lightweight_charts_esistjosh',
    version='3.0.8',
    packages=find_packages(),
    python_requires='>=3.8',
    install_requires=[
        'pandas',
        'yfinance',
        'pywebview>=5.0.5',
    ],
    package_data={
        # “**” says “and everything under here, at any depth”
        "lightweight_charts_esistjosh": [
            "defaults/**/*",
            "scripts/**/*",
            "js/*.js",
        ],
    },

    author='EsIstJosh',
    license='MIT/AGPL-3.0',
    description="Python framework for TradingView's Lightweight Charts JavaScript library.",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url='https://github.com/EsIstJosh/lightweight-charts-python',
)
