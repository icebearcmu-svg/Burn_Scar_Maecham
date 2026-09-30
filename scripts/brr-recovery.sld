<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld https://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>brr_recovery</Name>
    <UserStyle>
      <Title>BRR recovery classes</Title>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>0.96</Opacity>
            <ColorMap type="values">
              <ColorMapEntry color="#000000" quantity="0" opacity="0" label="No data"/>
              <ColorMapEntry color="#b2182b" quantity="1" label="Very poor"/>
              <ColorMapEntry color="#ef8a62" quantity="2" label="Poor"/>
              <ColorMapEntry color="#fddbc7" quantity="3" label="Moderate"/>
              <ColorMapEntry color="#d1e5f0" quantity="4" label="Good"/>
              <ColorMapEntry color="#67a9cf" quantity="5" label="Very good"/>
              <ColorMapEntry color="#2166ac" quantity="6" label="Excellent"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
